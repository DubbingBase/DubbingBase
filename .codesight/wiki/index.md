# dubbing-base-monorepo — Wiki

_Generated 2026-09-17 — re-run `npx codesight --wiki` if the codebase has changed._

Structural map compiled from source code via AST. No LLM — deterministic, 200ms.

> **How to use safely:** These articles tell you WHERE things live and WHAT exists. They do not show full implementation logic. Always read the actual source files before implementing new features or making changes. Never infer how a function works from the wiki alone.

## Articles

- [Overview](./overview.md)
- [Database](./database.md)
- [[id].get](./[id].get.md)
- [Career-grid.get](./career-grid.get.md)
- [Cast-vote.post](./cast-vote.post.md)
- [Count-voice-actor-works.post](./count-voice-actor-works.post.md)
- [Create-user-profile.post](./create-user-profile.post.md)
- [Dashboard-stats.get](./dashboard-stats.get.md)
- [Delete-user-voice-actor-link.post](./delete-user-voice-actor-link.post.md)
- [Delete-voice-actor-link.post](./delete-voice-actor-link.post.md)
- [Delete-work-entry.post](./delete-work-entry.post.md)
- [Delete_user.post](./delete_user.post.md)
- [Detail-collections.get](./detail-collections.get.md)
- [Extract-credits-from-image.post](./extract-credits-from-image.post.md)
- [Extract-voice-actor-info.post](./extract-voice-actor-info.post.md)
- [Find_duplicate_voice_actors.get](./find_duplicate_voice_actors.get.md)
- [Find_duplicate_work.get](./find_duplicate_work.get.md)
- [Games.get](./games.get.md)
- [Generate-social-content.post](./generate-social-content.post.md)
- [Get-dubbing-project.get](./get-dubbing-project.get.md)
- [Get-media-credits.get](./get-media-credits.get.md)
- [Get-metadata.get](./get-metadata.get.md)
- [Get-random-task.get](./get-random-task.get.md)
- [Get-studio-details.get](./get-studio-details.get.md)
- [Get-user-profile.get](./get-user-profile.get.md)
- [Get-user-voice-actor](./get-user-voice-actor.md)
- [Get-user-voice-actors.get](./get-user-voice-actors.get.md)
- [Get-work-votes.get](./get-work-votes.get.md)
- [Home-stats.get](./home-stats.get.md)
- [Index.get](./index.get.md)
- [Internal-media-create.post](./internal-media-create.post.md)
- [Internal-media-credits.get](./internal-media-credits.get.md)
- [Internal-media-metadata.get](./internal-media-metadata.get.md)
- [Link-user-voice-actor.post](./link-user-voice-actor.post.md)
- [Link-voice-actor.post](./link-voice-actor.post.md)
- [List-voice-actors.get](./list-voice-actors.get.md)
- [List_users.get](./list_users.get.md)
- [Manage-subscription.post](./manage-subscription.post.md)
- [Media-queue.post](./media-queue.post.md)
- [Merge_voice_actor_duplicates.post](./merge_voice_actor_duplicates.post.md)
- [Movies.get](./movies.get.md)
- [Notify-subscribers.post](./notify-subscribers.post.md)
- [Prepare-trending-media.post](./prepare-trending-media.post.md)
- [Prepare_game.post](./prepare_game.post.md)
- [Prepare_media.post](./prepare_media.post.md)
- [Process-credits.post](./process-credits.post.md)
- [Process-media-queue.post](./process-media-queue.post.md)
- [Recent-voice-actors.get](./recent-voice-actors.get.md)
- [Request-voice-actor-page.post](./request-voice-actor-page.post.md)
- [Revert-task.post](./revert-task.post.md)
- [Save-dubbing-project.post](./save-dubbing-project.post.md)
- [Save-metadata.post](./save-metadata.post.md)
- [Save-studio.post](./save-studio.post.md)
- [Search-voice-actors.get](./search-voice-actors.get.md)
- [Shows.get](./shows.get.md)
- [Submit-task.post](./submit-task.post.md)
- [Submit-user-report.post](./submit-user-report.post.md)
- [Top-contributors.get](./top-contributors.get.md)
- [Top-voice-actors.get](./top-voice-actors.get.md)
- [Update-review-status.post](./update-review-status.post.md)
- [Update-user-profile.post](./update-user-profile.post.md)
- [Update-voice-actor.post](./update-voice-actor.post.md)
- [Update_user_role.post](./update_user_role.post.md)
- [Update_voice_actor_link.post](./update_voice_actor_link.post.md)
- [Upload-profile-picture.post](./upload-profile-picture.post.md)
- [Voice-actors.get](./voice-actors.get.md)
- [Ui](./ui.md)
- [Libraries](./libraries.md)

## Quick Stats

- Routes: **75**
- Models: **16**
- Components: **197**
- Env vars: **45** required, **18** with defaults

## How to Use

- **New session:** read `index.md` (this file) for orientation — WHERE things are
- **Architecture question:** read `overview.md` (~500 tokens)
- **Domain question:** read the relevant article, then **read those source files**
- **Database question:** read `database.md`, then read the actual schema files
- **Library question:** read `libraries.md`, then read the listed source files
- **Before implementing anything:** read the source files listed in the article
- **Full source context:** read `.codesight/CODESIGHT.md`

## What the Wiki Does Not Cover

These exist in your codebase but are **not** reflected in wiki articles:
- Routes registered dynamically at runtime (loops, plugin factories, `app.use(dynamicRouter)`)
- Internal routes from npm packages (e.g. Better Auth's built-in `/api/auth/*` endpoints)
- WebSocket and SSE handlers
- Raw SQL tables not declared through an ORM
- Computed or virtual fields absent from schema declarations
- TypeScript types that are not actual database columns
- Routes marked `[inferred]` were detected via regex and may have lower precision
- gRPC, tRPC, and GraphQL resolvers may be partially captured

When in doubt, search the source. The wiki is a starting point, not a complete inventory.

---
_Last compiled: 2026-09-17 · 69 articles · [codesight](https://github.com/Houseofmvps/codesight)_