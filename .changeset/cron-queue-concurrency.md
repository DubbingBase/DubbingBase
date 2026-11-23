---
"@app/website": patch
---

Speed up the media queue: the cron dispatcher now drains ready queues for up to 40 s per tick instead of one batch per minute, a manual enqueue starts the dispatcher immediately, batch items and per-language/per-target enqueue RPCs run concurrently, and the internal-secret lookup is shared. Queue-batch Discord notifications are grouped into one message per destination with a severity summary, counted duplicates and detail embeds for problems only.
