---
"@app/website": patch
"@app/shared-logic": patch
---

Remove two redundant type declaration files: `apps/website/src/types/posthog.d.ts` (declared a `$posthog` property nothing reads) and `apps/website/src/global.d.ts` (re-declared the vue-i18n template helpers that the i18n module already types). Document why `packages/shared-logic/src/global.d.ts` is still needed.
