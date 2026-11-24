# Index.post

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Index.post subsystem handles **2 routes** and touches: auth, db, cache.

## Routes

- `POST` `/api/tokens/index` [auth, db, cache]
  `apps/website/server/api/tokens/index.post.ts`
- `POST` `/api/v1/:type/index` params(type) [auth]
  `apps/website/server/api/v1/[type]/index.post.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/api/tokens/index.post.ts`
- `apps/website/server/api/v1/[type]/index.post.ts`

---
_Back to [overview.md](./overview.md)_