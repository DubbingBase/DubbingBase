---
"@app/website": patch
---

Replace `as` type assertions in the website server routes, utilities and admin/auth pages with real narrowing (`asString`, `instanceof`, type guards) so the `consistent-type-assertions` lint rule passes. Click-outside handlers keep working for SVG targets, and non-string query parameters now fall back to their defaults instead of being passed through.
