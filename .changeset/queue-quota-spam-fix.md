---
"@app/website": patch
---

fix(queue): delay quota-exhausted messages 1h via RPC and notify once instead of every cron tick; fix(llm): replace decommissioned Groq default `llama-3.3-70b-versatile` with `openai/gpt-oss-120b`
