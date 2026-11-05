---
"@app/website": patch
"@app/shared-logic": patch
"@app/og-image": patch
---

Enable type-aware linting (`oxlint-tsgolint`): the `typescript/no-unsafe-*`, `no-floating-promises`, `no-misused-promises` and `await-thenable` rules now catch `any` that is never written (`readBody`, `Response.json()`, `Reflect.get`). Give the Nitro server its own `tsconfig.json`, type the keys stored on `event.context`, replace `Reflect.get` with `readProperty` in the trending/search routes and TMDB/IGDB clients, type `useHomeData`'s fetch error handling, and drop the og-image tsconfig's dead `extends`. Files that still need work are listed in the `.oxlintrc.json` legacy override.
