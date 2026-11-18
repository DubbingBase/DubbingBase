---
"@app/website": patch
---

Remove the PostHog `enqueue-on-navigate` feature flag and the lazy enqueue-on-navigation code it gated in the movie, show, toy, audiobook, podcast and advertisement routes. The flag is not defined in PostHog, so it already evaluated to off and the block never ran; each unprocessed page view only paid a network request to PostHog to learn that.
