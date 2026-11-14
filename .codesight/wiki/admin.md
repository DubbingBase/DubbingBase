# Admin

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Admin subsystem handles **5 routes** and touches: auth, queue, cache.

## Routes

- `POST` `/api/admin/queue/clear` [auth, queue]
  `apps/website/server/api/admin/queue/clear.post.ts`
- `DELETE` `/api/admin/queue/item` [auth, queue]
  `apps/website/server/api/admin/queue/item.delete.ts`
- `GET` `/api/admin/queue` [auth, queue]
  `apps/website/server/api/admin/queue.get.ts`
- `POST` `/api/admin/work-duplicates/merge` [auth]
  `apps/website/server/api/admin/work-duplicates/merge.post.ts`
- `GET` `/api/admin/work-duplicates` [auth, cache]
  `apps/website/server/api/admin/work-duplicates.get.ts`

## Related Models

- **admin_credit_import_requests** (4 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/api/admin/queue/clear.post.ts`
- `apps/website/server/api/admin/queue/item.delete.ts`
- `apps/website/server/api/admin/queue.get.ts`
- `apps/website/server/api/admin/work-duplicates/merge.post.ts`
- `apps/website/server/api/admin/work-duplicates.get.ts`

---
_Back to [overview.md](./overview.md)_