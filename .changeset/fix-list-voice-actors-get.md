---
"@app/website": patch
---

Fix 404 on the voice actors listing page by adding a GET handler for /api/list-voice-actors (the page calls it with GET; only a POST handler existed)
