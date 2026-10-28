# [id].get

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The [id].get subsystem handles **10 routes** and touches: queue.

## Routes

- `GET` `/api/actor/:id` params(id)
  `apps/website/server/api/actor/[id].get.ts`
- `GET` `/api/advertisement/:id` params(id) [queue]
  `apps/website/server/api/advertisement/[id].get.ts`
- `GET` `/api/audiobook/:id` params(id) [queue]
  `apps/website/server/api/audiobook/[id].get.ts`
- `GET` `/api/game/:id` params(id) [queue]
  `apps/website/server/api/game/[id].get.ts`
- `GET` `/api/movie/:id` params(id) [queue]
  `apps/website/server/api/movie/[id].get.ts`
- `GET` `/api/podcast/:id` params(id) [queue]
  `apps/website/server/api/podcast/[id].get.ts`
- `GET` `/api/show/:id` params(id) [queue]
  `apps/website/server/api/show/[id].get.ts`
- `GET` `/api/toy/:id` params(id) [queue]
  `apps/website/server/api/toy/[id].get.ts`
- `GET` `/api/toy-metadata/:id` params(id)
  `apps/website/server/api/toy-metadata/[id].get.ts`
- `GET` `/api/voice-actor/:id` params(id)
  `apps/website/server/api/voice-actor/[id].get.ts`

## High-Impact Files

- `apps/website/server/api/actor/[id].get.ts` — imported by 4 files

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/api/actor/[id].get.ts`
- `apps/website/server/api/advertisement/[id].get.ts`
- `apps/website/server/api/audiobook/[id].get.ts`
- `apps/website/server/api/game/[id].get.ts`
- `apps/website/server/api/movie/[id].get.ts`
- `apps/website/server/api/podcast/[id].get.ts`
- `apps/website/server/api/show/[id].get.ts`
- `apps/website/server/api/toy/[id].get.ts`
- `apps/website/server/api/toy-metadata/[id].get.ts`
- `apps/website/server/api/voice-actor/[id].get.ts`

---
_Back to [overview.md](./overview.md)_