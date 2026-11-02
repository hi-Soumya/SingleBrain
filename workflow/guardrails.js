// n8n Code node "Guardrails and Decide" (run once for all items).
// Input: one model response per lead from "LLM Triage", in the same order as "Parse and Check".
// Output: a single item with the decisions list and the per-row run log.
const QUALIFY_MIN_BUDGET = 15000; // Single Grain's Head of Sales post: engagements of $15k-$25k+/month
const DECISIONS = ['QUALIFY', 'NURTURE', 'REJECT', 'ESCALATE'];

const parsed = $('Parse and Check').all().map(function (i) { return i.json; });
const responses = $input.all().map(function (i) { return i.json; });

function readModel(resp) {
  try {
    if (resp.error) return { error: 'model call failed: ' + String(resp.error.message || resp.error).slice(0, 160) };
    const content = resp.choices[0].message.content;
    const j = JSON.parse(content);
    const decision = String(j.decision || '').toUpperCase();
    const conf = Number(j.confidence);
    if (DECISIONS.indexOf(decision) < 0) return { error: 'invalid decision ' + JSON.stringify(j.decision), raw: content };
    if (!(conf >= 0 && conf <= 1)) return { error: 'invalid confidence ' + JSON.stringify(j.confidence), raw: content };
    return { decision: decision, confidence: conf, reason: String(j.reason || '').trim(), manipulation_attempt: j.manipulation_attempt === true, raw: content };
  } catch (e) {
    return { error: 'unparseable model output: ' + String(e.message || e).slice(0, 120) };
  }
}

const decisions = [];
const log = [];

parsed.forEach(function (p, i) {
  const f = p.flags;
  const has = function (x) { return f.indexOf(x) >= 0; };
  const m = readModel(responses[i] || {});
  const applied = [];
  let decision = m.decision;
  let confidence = m.confidence;
  let reason = m.reason;
  const set = function (d, c, r, rule) {
    if (decision !== d || reason !== r) applied.push(rule + ': ' + (decision || 'none') + ' -> ' + d);
    decision = d; confidence = c; reason = r;
  };
  const cap = function (c, rule) { if (confidence > c) { applied.push(rule + ': confidence ' + confidence + ' -> ' + c); confidence = c; } };

  // 1. Model output must be valid, or a person looks at it.
  if (m.error) set('ESCALATE', 0.5, 'Automated triage failed (' + m.error + '); needs a manual first pass.', 'invalid_model_output');

  // 2. Hard routes that never depend on the model.
  if (has('privacy_request')) set('ESCALATE', 0.95, 'Data-deletion (GDPR/CCPA) request, not a sales lead; route to the privacy owner, who has a legal deadline.', 'privacy_request');
  else if (has('executable_link') || (has('phishing_language') && has('email_website_domain_mismatch'))) set('REJECT', 0.95, 'Phishing pattern (payment pressure plus a link to an executable); do not open the link, report to security.', 'security');
  else if (has('duplicate')) set('REJECT', 0.9, 'Duplicate of ' + p.duplicate_of + ' (same contact and company); merge its notes into that lead instead of opening a second record.', 'duplicate');
  else if (has('test_or_junk')) set('REJECT', 0.95, 'Test or junk submission (placeholder name, company and message).', 'junk');

  // 3. Limits on what the model may decide.
  // A sender who tries to steer the triage never enters an automated sales or nurture sequence.
  const budget = p.lead.monthly_budget_usd;
  if ((decision === 'QUALIFY' || decision === 'NURTURE') && has('prompt_injection_attempt')) {
    if (budget !== null && budget < QUALIFY_MIN_BUDGET) set('REJECT', 0.85, 'Lead text tried to instruct the triage system, and on its merits it is weak (stated budget below the $15k floor, no concrete need); do not add it to automated sequences.', 'injection_no_automation');
    else set('ESCALATE', 0.6, 'Lead text tried to instruct the triage system; a person should judge it on its merits before any outreach.', 'injection_no_automation');
  }
  // No stated need means nothing to qualify on; the model flipped on this across runs 1-3.
  if (decision === 'QUALIFY' && has('empty_message')) set('ESCALATE', 0.65, 'Budget is stated but the message is empty, so there is no need to qualify on; a person should make the first contact.', 'no_stated_need');
  if (decision === 'QUALIFY' && has('pricing_or_methodology_research')) set('ESCALATE', 0.6, 'Asks for pricing or methodology, possibly for a third party; confirm they are a buyer before sending anything.', 'pricing_research_never_qualifies');
  if ((decision === 'QUALIFY' || decision === 'NURTURE') && (has('missing_email') || has('invalid_email'))) set('ESCALATE', 0.7, (reason ? reason.replace(new RegExp('[.]$'), '') + '; ' : '') + 'no usable email, so a person must find the contact before any outreach.', 'no_contact');
  if (decision === 'QUALIFY' && (has('disposable_email') || (has('freemail') && has('missing_company')))) set('ESCALATE', 0.6, 'Claims a large budget but the sender cannot be verified (personal or throwaway email, no company); verify before sales time is spent.', 'unverifiable_sender');
  if (decision === 'QUALIFY' && budget !== null && budget < QUALIFY_MIN_BUDGET) set('NURTURE', 0.7, (reason ? reason.replace(new RegExp('[.]$'), '') + '; ' : '') + 'budget is below the $15k/month engagement floor.', 'budget_floor');
  if (decision === 'QUALIFY' && (has('budget_not_a_number') || has('budget_parsed_from_text'))) cap(0.75, 'budget_not_clean');
  if (has('malformed_timestamp')) cap(0.8, 'malformed_timestamp');
  if (decision !== 'ESCALATE' && confidence < 0.55) set('ESCALATE', confidence, 'Low-confidence call (' + reason + '); a person should decide.', 'low_confidence');

  const flagged = [];
  if (has('prompt_injection_attempt')) flagged.push('manipulation attempt flagged');
  else if (m.manipulation_attempt) flagged.push('model suspected manipulation, not confirmed by rules');
  if (has('malformed_timestamp')) flagged.push('submitted_at is not a valid date');
  if (has('budget_parsed_from_text')) flagged.push('budget parsed from text');
  if (p.same_contact_as) flagged.push('same contact as ' + p.same_contact_as);
  if (flagged.length && reason.indexOf(flagged[0]) < 0) reason = reason.replace(new RegExp('[.]$'), '') + ' (' + flagged.join('; ') + ').';

  decisions.push({ lead_id: p.lead_id, decision: decision, reason: reason, confidence: Math.round(confidence * 100) / 100, flags: f.join('; '), duplicate_of: p.duplicate_of });
  log.push({ lead_id: p.lead_id, flags: f, model_raw: m.raw || null, model_error: m.error || null, model_decision: m.decision || null, model_confidence: m.confidence === undefined ? null : m.confidence, guardrails_applied: applied, final_decision: decision });
});

const counts = {};
decisions.forEach(function (d) { counts[d.decision] = (counts[d.decision] || 0) + 1; });
return [{ json: { run_at: new Date().toISOString(), rows_in: parsed.length, rows_out: decisions.length, counts: counts, decisions: decisions, log: log } }];
