---
"@app/supabase": patch
---

Disable only the temporary regional-language guard during bulk mapping to prevent advisory-lock exhaustion. Replace the dubbing-language registry table with a schema-owned CHECK rule, use an unfiltered production data dump for normal local reset, and synchronize Storage separately through the Supabase CLI.
