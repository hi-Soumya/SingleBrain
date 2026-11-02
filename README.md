# Beat Claude 012: Lead Triage Agent

Submission by Soumya Ranjan Behera for Single Grain's [Beat Claude](https://github.com/ericosiu/beat-claude) challenge AI Automation Intern 012 (brief version 2026-07), sent with an application for AI Automation Engineer.

**Start with [SUBMISSION.md](SUBMISSION.md).**

| What | Where |
|---|---|
| Write-up (all 7 packet sections) | [SUBMISSION.md](SUBMISSION.md) |
| Decisions file, submitted run | [decisions.csv](decisions.csv), [decisions.json](decisions.json) |
| Run logs (5 runs, raw responses) | [run/](run/) |
| Agent vs manual pass | [run/comparison.md](run/comparison.md), [run/manual-pass.csv](run/manual-pass.csv) |
| Code-node sources | [workflow/](workflow/) |
| Re-run the live agent | `node scripts/run.mjs fixtures/inbound_leads.csv` |

Live endpoint, no login needed: `POST https://hisoumya.app.n8n.cloud/webhook/sg-lead-triage-012` with `{"csv": "..."}`.

Fixture SHA-256 (raw GitHub file): `cc1927ca771c37b186a2abdb7b9757594da79ec6dda074e5a514dd2761cc8599`
