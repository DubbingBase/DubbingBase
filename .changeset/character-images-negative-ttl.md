---
"@app/website": patch
---

Cache character-image responses that contain "no image" cards for a day at the edge instead of a week, matching their 24-hour lifetime in KV.
