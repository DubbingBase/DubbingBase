---
"@app/website": patch
---

Serve the public About pages as prerendered HTML without Nuxt hydration, while preserving ordinary navigation and static theme/language preference links. Generate light-theme variants and remove unused font faces from their stylesheet. Split the shared header preferences into a smaller async component for the interactive pages.
