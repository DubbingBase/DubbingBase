# Extract-voice-actor-info.post

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Extract-voice-actor-info.post subsystem handles **1 routes** and touches: auth.

## Routes

- `POST` `/api/extract-voice-actor-info` [auth]
  `apps/website/server/api/extract-voice-actor-info.post.ts`

## Related Models

- **voice_actors** (2 fields) → [database.md](./database.md)
- **user_voice_actor_links** (3 fields) → [database.md](./database.md)
- **voice_actor_subscriptions** (2 fields) → [database.md](./database.md)
- **voice_actor_write_requests** (6 fields) → [database.md](./database.md)
- **user_voice_actor_link_requests** (11 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/api/extract-voice-actor-info.post.ts`

---
_Back to [overview.md](./overview.md)_