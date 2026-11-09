---
"@app/website": patch
---

Global search now treats TMDB's top movie/TV hit as an exact-tier match, since TMDB already matches alternate titles, with no extra provider calls. It also halves the recency bonus for results with no popularity or vote evidence so established exact matches outrank fresh unrated ones.
