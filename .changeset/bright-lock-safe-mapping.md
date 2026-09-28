---
"@app/supabase": patch
---

Disable only the temporary regional-language guard during the controlled legacy mapping migration to avoid retaining one advisory transaction lock per project. Load production-derived local data at the pre-mapping checkpoint without duplicating migration-owned registry rows.
