---
"@app/website": patch
---

Skip the Doppler link step in `mise run` tasks when Doppler is not installed, and format generated database types before normalizing them, so the CI database checks can run.
