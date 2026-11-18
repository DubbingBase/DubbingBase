---
"@app/website": patch
---

Make client analytics anonymous and minimal: PostHog no longer sets a cookie (in-memory persistence), no longer identifies signed-in users, and stops autocapturing clicks and capturing console and unhandled errors. It still sends page views only. The server-side feature-flag call is unchanged.
