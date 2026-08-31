---
"@app/website": patch
---

Fix OpenAI / Groq Strict JSON Schema compliance for dubbing extraction:

- Ensure all object properties are listed in `required` by making optional fields nullable (`performance: z.string().nullable()`).
- Make `items: z.array(...)` non-optional in `dubbingExtractionSchema`.
