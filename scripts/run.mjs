// Re-run the live triage agent on a CSV and save the response.
// Usage: node scripts/run.mjs fixtures/inbound_leads.csv [out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const file = process.argv[2] || 'fixtures/inbound_leads.csv';
const out = process.argv[3] || 'run/latest.json';
const csv = readFileSync(file, 'utf8');
console.log('fixture sha256', createHash('sha256').update(readFileSync(file)).digest('hex'));

const res = await fetch('https://hisoumya.app.n8n.cloud/webhook/sg-lead-triage-012', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ csv })
});
const body = await res.json();
writeFileSync(out, JSON.stringify(body, null, 2));
console.log(res.status, body.rows_in, 'rows in,', body.rows_out, 'out', JSON.stringify(body.counts));
for (const d of body.decisions || []) console.log(d.lead_id, d.decision.padEnd(8), d.confidence, d.reason);
