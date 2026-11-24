---
"@app/supabase": patch
---

`mise run backup-db` reads the production database password from Doppler (`SUPABASE_DB_PASSWORD` in the `prd` config) instead of prompting; the script still accepts `SUPABASE_PASSWORD` or a prompt when run directly.
