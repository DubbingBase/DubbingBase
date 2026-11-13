---
"@app/website": patch
---

Resolve OG-image fonts from the built `.output/public` directory as well as `public/` when they are read from disk, so a node-server deployment started from another directory still finds them.
