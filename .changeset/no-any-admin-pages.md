---
"@app/website": patch
---

Remove `any` from the admin dashboard, user/VA profile, merge, user, career grid, and studio pages, and from the admin chart wrappers. Chart props are now typed per Chart.js chart type, and catch blocks read error messages through a narrowing helper instead of assuming `Error`.
