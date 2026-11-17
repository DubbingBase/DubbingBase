---
"@app/website": patch
---

Fix the queue dispatcher's readiness check failing on every tick: `useSupabaseAdmin` passed the scheduled-task event to `useRuntimeConfig(event)`, which throws without a Nitro context, so every queue was dispatched each minute. It now falls back to the shared runtime config for task events.
