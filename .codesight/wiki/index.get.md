# Index.get

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Index.get subsystem handles **7 routes** and touches: db, auth, cache.

## Routes

- `GET` `/api/episode/index`
  `apps/website/server/api/episode/index.get.ts`
- `GET` `/api/search/index` [db]
  `apps/website/server/api/search/index.get.ts`
- `GET` `/api/season/index`
  `apps/website/server/api/season/index.get.ts`
- `GET` `/api/tokens/index` [auth, cache]
  `apps/website/server/api/tokens/index.get.ts`
- `GET` `/api/v1/:type/:id/credits/index` params(type, id)
  `apps/website/server/api/v1/[type]/[id]/credits/index.get.ts`
- `GET` `/api/v1/:type/:id/index` params(type, id)
  `apps/website/server/api/v1/[type]/[id]/index.get.ts`
- `GET` `/api/v1/voice-actors/index`
  `apps/website/server/api/v1/voice-actors/index.get.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/api/episode/index.get.ts`
- `apps/website/server/api/search/index.get.ts`
- `apps/website/server/api/season/index.get.ts`
- `apps/website/server/api/tokens/index.get.ts`
- `apps/website/server/api/v1/[type]/[id]/credits/index.get.ts`
- `apps/website/server/api/v1/[type]/[id]/index.get.ts`
- `apps/website/server/api/v1/voice-actors/index.get.ts`

---
_Back to [overview.md](./overview.md)_