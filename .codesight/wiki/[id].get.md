# [id].get

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The [id].get subsystem handles **12 routes** and touches: auth, cache.

## Routes

- `GET` `/api/actor/:id` params(id) [auth, cache]
  `apps/website/server/api/actor/[id].get.ts`
- `GET` `/api/advertisement/:id` params(id)
  `apps/website/server/api/advertisement/[id].get.ts`
- `GET` `/api/audiobook/:id` params(id)
  `apps/website/server/api/audiobook/[id].get.ts`
- `GET` `/api/character/:source/:id` params(source, id)
  `apps/website/server/api/character/[source]/[id].get.ts`
- `GET` `/api/game/:id` params(id) [auth]
  `apps/website/server/api/game/[id].get.ts`
- `GET` `/api/movie/:id` params(id)
  `apps/website/server/api/movie/[id].get.ts`
- `GET` `/api/podcast/:id` params(id)
  `apps/website/server/api/podcast/[id].get.ts`
- `GET` `/api/show/:id` params(id)
  `apps/website/server/api/show/[id].get.ts`
- `GET` `/api/toy/:id` params(id)
  `apps/website/server/api/toy/[id].get.ts`
- `GET` `/api/toy-metadata/:id` params(id)
  `apps/website/server/api/toy-metadata/[id].get.ts`
- `GET` `/api/v1/voice-actors/:id` params(id)
  `apps/website/server/api/v1/voice-actors/[id].get.ts`
- `GET` `/api/voice-actor/:id` params(id)
  `apps/website/server/api/voice-actor/[id].get.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/api/actor/[id].get.ts`
- `apps/website/server/api/advertisement/[id].get.ts`
- `apps/website/server/api/audiobook/[id].get.ts`
- `apps/website/server/api/character/[source]/[id].get.ts`
- `apps/website/server/api/game/[id].get.ts`
- `apps/website/server/api/movie/[id].get.ts`
- `apps/website/server/api/podcast/[id].get.ts`
- `apps/website/server/api/show/[id].get.ts`
- `apps/website/server/api/toy/[id].get.ts`
- `apps/website/server/api/toy-metadata/[id].get.ts`
- `apps/website/server/api/v1/voice-actors/[id].get.ts`
- `apps/website/server/api/voice-actor/[id].get.ts`

---
_Back to [overview.md](./overview.md)_