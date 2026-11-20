---
"@app/website": patch
---

Stop loading the PostHog session recorder and web-vitals bundles. Replay and performance capture were never used, and the privacy page only promises page views.
