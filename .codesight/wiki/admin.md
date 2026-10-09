# Admin

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Admin subsystem handles **5 routes** and touches: auth, queue.

## Routes

- `GET` `/api/admin/dubbing-project` [auth]
  `apps/website/server/api/admin/dubbing-project.get.ts`
- `POST` `/api/admin/dubbing-project` [auth]
  `apps/website/server/api/admin/dubbing-project.post.ts`
- `POST` `/api/admin/queue/clear` [auth, queue]
  `apps/website/server/api/admin/queue/clear.post.ts`
- `DELETE` `/api/admin/queue/item` [auth, queue]
  `apps/website/server/api/admin/queue/item.delete.ts`
- `GET` `/api/admin/queue` [auth, queue]
  `apps/website/server/api/admin/queue.get.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/api/admin/dubbing-project.get.ts`
- `apps/website/server/api/admin/dubbing-project.post.ts`
- `apps/website/server/api/admin/queue/clear.post.ts`
- `apps/website/server/api/admin/queue/item.delete.ts`
- `apps/website/server/api/admin/queue.get.ts`

---
_Back to [overview.md](./overview.md)_