---
"@app/website": patch
---

Global search now uses TMDB's own relevance order as a graded ranking floor, since TMDB already matches alternate titles, with no extra provider calls. It also halves the recency bonus for results with no popularity or vote evidence so established exact matches outrank fresh unrated ones.
