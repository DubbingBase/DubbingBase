# Index.get

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Index.get subsystem handles **4 routes** and touches: cache, db.

## Routes

- `GET` `/api/episode/index` [cache]
  `apps/website/server/api/episode/index.get.ts`
- `GET` `/api/og-image/index` [cache]
  `apps/website/server/api/og-image/index.get.ts`
- `GET` `/api/search/index` [db, cache]
  `apps/website/server/api/search/index.get.ts`
- `GET` `/api/season/index` [cache]
  `apps/website/server/api/season/index.get.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/api/episode/index.get.ts`
- `apps/website/server/api/og-image/index.get.ts`
- `apps/website/server/api/search/index.get.ts`
- `apps/website/server/api/season/index.get.ts`

---
_Back to [overview.md](./overview.md)_