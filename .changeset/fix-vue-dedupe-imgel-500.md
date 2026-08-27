---
"@app/website": patch
"@app/mobile": patch
"@app/shared-logic": patch
---

Fix 500 error on SSR caused by duplicate Vue instances colliding on template refs (`Cannot redefine property: imgEl`).

- Enforce monorepo-wide Vue deduplication via `pnpm.overrides` and `pnpm-workspace.yaml`.
- Add explicit `vite.resolve.dedupe` rules in website and mobile configs.
- Add regression test in website unit test suite to prevent future recurrence.
