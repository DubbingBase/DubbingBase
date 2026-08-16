---
"@app/website": patch
"@app/shared-logic": patch
---

Restore a runnable typecheck: pin `typescript` to `~6.0.3` in `apps/website` and `packages/shared-logic` to match `@app/mobile` and the locked `vue-tsc@3.3.8` (which is incompatible with TypeScript 7's removed `./lib/tsc` export). Previously `nuxt typecheck` crashed before type-checking ran, so type errors were invisible.
