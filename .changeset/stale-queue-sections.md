---
"@app/website": patch
---

Clear poisoned queue elements at extract time: revalidate requested Wikipedia sections against dubbing headings (check and extract run on different cron ticks) and fail fast with an explanatory message instead of running the LLM on stale sections.
