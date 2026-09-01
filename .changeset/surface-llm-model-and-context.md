---
"@app/website": patch
---

feat(llm): surface model + context on extraction results

LLM calls now report which model served the response (e.g. "Gemini
(gemini-3.5-flash-lite)") and extraction steps log when a section
yields no dubbing rows. The queue dispatcher Discord notification,
admin email for social posts, and manual prepare_game handler all
forward the model name and any "no dubbing found" note so it's
clear which model produced the output and why a section came back
empty.
