---
"@app/website": patch
---

Limit service worker precaching to offline.html so retired Cloudflare deployment assets cannot block worker installation, while preserving network navigation and the PWA install/update lifecycle.
