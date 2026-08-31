---
"@app/website": patch
---

Add Cloudflare Worker 1-minute cron dispatcher using Nitro tasks:

- Enable `nitro.experimental.tasks` and map `scheduledTasks: { '* * * * *': ['dispatcher'] }` in `nuxt.config.ts`.
- Add Cloudflare Worker cron trigger `[triggers] crons = ['* * * * *']` in `wrangler.toml`.
- Implement `server/tasks/dispatcher.ts` with a 6-iteration loop (10s intervals), dispatching `wiki_discovery` and `wiki_check` every 10 seconds and `wiki_extract` (LLM) on iteration 0, using `ctx.waitUntil(...)` for non-blocking concurrent execution.
