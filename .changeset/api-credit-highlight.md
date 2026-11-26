---
"@app/website": patch
"@app/supabase": patch
---

Let the v1 credit API set `highlight` (main character): `PATCH /credits/{workId}` accepts it, and `POST /credits/batch` items can flag the credit they create. Adds a migration extending `update_voice_actor_work_credit` and `api_mutate_credits`.
