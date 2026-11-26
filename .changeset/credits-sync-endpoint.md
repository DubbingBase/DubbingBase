---
"@app/website": minor
---

Replace `POST /credits/batch` with `POST /{type}/{id}/credits/sync`: it creates missing credits, updates `performance` and `highlight` of existing ones (reported as `update` with `changes`) and leaves the rest `unchanged`, so re-running a fill converges. It needs both `credits:create` and `credits:update`. Credit `GET`/`PATCH` return an `ETag`, and `PATCH` honours `If-Match` with `412 precondition_failed`.
