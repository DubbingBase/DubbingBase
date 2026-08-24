---
"@app/website": patch
---

Fix Android Play Store upload by setting a strictly-increasing ANDROID_VERSION_CODE (2000000 + GitHub run number) on main builds, preventing "Version code already used" errors
