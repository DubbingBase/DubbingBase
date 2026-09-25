# Admin

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Admin subsystem handles **2 routes** and touches: auth, queue.

## Routes

- `POST` `/api/admin/queue/clear` [auth, queue]
  `apps/website/server/api/admin/queue/clear.post.ts`
- `DELETE` `/api/admin/queue/item` [auth, queue]
  `apps/website/server/api/admin/queue/item.delete.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/api/admin/queue/clear.post.ts`
- `apps/website/server/api/admin/queue/item.delete.ts`

---
_Back to [overview.md](./overview.md)_