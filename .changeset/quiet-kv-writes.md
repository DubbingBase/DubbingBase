---
"@app/website": patch
---

Define persistent, read-only, and uncached provider policies; stop persisting volatile searches, trends, and Wikipedia responses while retaining KV for auth tokens and stable metadata used by internal fanout. Add distinct browser and Cloudflare edge cache profiles, extend media-page SWR to one hour, and skip cache writes for volatile queue inputs.
