---
"@app/website": patch
---

fix(website): resolve admin queue table display issue and add translations

- Group queue filters and table together so the queue items grid renders properly
- Add empty state message when search or status filters match no items
- Add missing localization strings across all locales (EN, FR, ES, JA)
- Use strict TypeScript typing without type assertions
