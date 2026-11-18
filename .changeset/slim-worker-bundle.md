---
"@app/website": patch
---

Slim the Worker bundle: call the Gemini REST API with `fetch` instead of the Vercel AI SDK (`ai`, `@ai-sdk/google` and their gateway and provider-utils dependencies, about 385 KB), remove the three unused LLM helpers (`llmGenerate`, `llmVision`, `llmVisionObject`) and `getLlmQuotaCache`, and render `/admin/**` in the browser only so Nuxt leaves the admin pages out of the server bundle.
