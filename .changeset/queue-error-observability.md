---
"@app/website": patch
---

Diagnose recurring queue extraction failures: log the raw unstringified error in worker logs and tag extract-failure notifications with the pipeline version so the running code is identifiable.
