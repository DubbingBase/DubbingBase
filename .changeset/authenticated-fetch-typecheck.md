---
"@app/website": patch
---

Fix the `TS2321` "excessive stack depth" typecheck failure in the authenticated `$fetch` plugin by calling the wrapped function through a plain `Function` helper. Runtime behavior is unchanged.
