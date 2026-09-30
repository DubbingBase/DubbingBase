---
"@app/supabase": patch
---

Disable only the temporary regional-language guard during bulk legacy mapping to prevent advisory-lock exhaustion. Convert legacy codes to regional codes, replace the temporary registry with a structural CHECK constraint, remove migration-only language helpers, use the normal full production dump and local reset, and keep Storage synchronization separate.
