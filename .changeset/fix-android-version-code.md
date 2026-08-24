---
"@app/website": patch
---

Fix Android Play Store upload by deriving ANDROID_VERSION_CODE from the package.json version (bumped via changeset) with the GitHub run number appended, preventing "Version code already used" errors
