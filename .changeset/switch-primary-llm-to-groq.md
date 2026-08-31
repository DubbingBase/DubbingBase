---
"@app/website": patch
---

Switch default primary LLM provider to Groq (Llama 3.3 70B) with Gemini fallback:

- Configure `llmProvider` in runtimeConfig defaulting to `"groq"` (configurable via `NUXT_LLM_PROVIDER`).
- Route all text and JSON object generations to Groq `llama-3.3-70b-versatile` by default to avoid Gemini rate limits.
- Fix default Gemini model fallback to `"gemini-2.5-flash"`.
