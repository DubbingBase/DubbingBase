# Admin

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Admin subsystem handles **2 routes** and touches: auth, cache.

## Routes

- `POST` `/api/admin/work-duplicates/merge` [auth]
  `apps/website/server/api/admin/work-duplicates/merge.post.ts`
- `GET` `/api/admin/work-duplicates` [auth, cache]
  `apps/website/server/api/admin/work-duplicates.get.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/api/admin/work-duplicates/merge.post.ts`
- `apps/website/server/api/admin/work-duplicates.get.ts`

---
_Back to [overview.md](./overview.md)_