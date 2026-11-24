---
"@app/supabase": minor
"@app/website": minor
"@app/shared-logic": minor
---

Add DubbingBase-owned media identity. A `media` table (own id, kind, the id the website uses for that kind as `content_id`, and an optional `wikidata_qid`) replaces the unconstrained `(content_type, content_id)` pair: `dubbing_projects`, `toy_metadata` and `game_characters` are keyed by `media_id` with real foreign keys, the legacy columns are dropped, and the RPCs resolve their reference through media. Toys and advertisements use `media.id` as their `content_id`; positive legacy ids are kept. Public website URLs and RPC signatures are unchanged, `media_id` now appears on some project payloads, and `prepare-trending-media` only matches movie and tv projects. This is a breaking schema change for the previous website build: deploy the migration and the Worker together (see `docs/release-pipeline.md`). `mise run reseed` now loads the production dump at production's schema version before applying newer migrations.
