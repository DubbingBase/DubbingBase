# Request-voice-actor-page.post

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Request-voice-actor-page.post subsystem handles **1 routes** and touches: auth, email.

## Routes

- `POST` `/api/request-voice-actor-page` [auth, email]
  `apps/website/server/api/request-voice-actor-page.post.ts`

## Related Models

- **voice_actors** (2 fields) → [database.md](./database.md)
- **user_voice_actor_links** (3 fields) → [database.md](./database.md)
- **voice_actor_subscriptions** (2 fields) → [database.md](./database.md)
- **voice_actor_write_requests** (6 fields) → [database.md](./database.md)
- **regional_assignment_request_audits** (4 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/api/request-voice-actor-page.post.ts`

---
_Back to [overview.md](./overview.md)_