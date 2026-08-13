---
"@app/website": patch
---

Fix missing skeleton loader on the game details page. The page only rendered its layout once data loaded, showing a blank screen during client-side navigation. It now shows `MediaSkeleton` while pending, matching the movie and show detail pages.
