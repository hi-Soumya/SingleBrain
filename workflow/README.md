# n8n workflow: Beat Claude 012 - Lead Triage Agent

Four nodes, in order:

| Node | Type | Settings |
|---|---|---|
| Leads In | Webhook v2.1 | POST `/webhook/sg-lead-triage-012`, respond with last node |
| Parse and Check | Code v2, run once for all items | `parse-check.js` |
| LLM Triage | HTTP Request v4.2 | POST `https://api.openai.com/v1/chat/completions`, OpenAI credential, JSON body `{{ JSON.stringify($json.request_body) }}`, timeout 60 s, retry on fail ×3 (2 s apart), on error: continue |
| Guardrails and Decide | Code v2, run once for all items | `guardrails.js` |

The Code nodes use `new RegExp('...')` strings and `String.fromCharCode` instead of regex literals with backslashes. They were pasted through an SDK that wraps code in template literals, where backslashes and backticks would break.

To rebuild it in another n8n instance: create the four nodes above, paste the two files, add an OpenAI credential, and publish.
