---
"@app/website": patch
---

Avoid redundant upstream metadata requests on actor pages by reusing complete media summaries from the person credits fetched in the same request, with fallback fetches for missing or incomplete titles.
