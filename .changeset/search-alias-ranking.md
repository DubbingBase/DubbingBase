---
"@app/website": patch
---

Global search now merges provider results with weighted Reciprocal Rank Fusion instead of DubbingBase's own title-matching and quality scoring. Each provider's own order decides relevance within its list, and media-type weights (voice actors, then movies and shows, games, people, then books and the rest) decide how lists interleave.
