---
"@app/website": patch
---

Fix cron execution and remove obsolete queue guards:

- Support `apikey`, `Authorization: Bearer`, and `x-internal-secret` in `/api/process-media-queue` and `/api/prepare-trending-media` for scheduled cron jobs.
- Remove obsolete `force`, `single`, and concurrency lock checking (`get_media_queue_locked_count`), relying purely on PGMQ's atomic `FOR UPDATE SKIP LOCKED`.
- Clean up `queue.vue` manual processing payload.
