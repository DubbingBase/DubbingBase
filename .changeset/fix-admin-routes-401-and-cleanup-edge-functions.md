---
"@app/website": patch
"@app/supabase": patch
"@app/shared-logic": patch
---

Fix 401 Unauthorized errors for admin routes, add missing API routes and RLS policies, remove legacy edge functions, and relocate database types:

- Fixed 401 Unauthorized during SSR and cookie authentication in `server/middleware/auth.ts` and `authenticated-fetch.ts`.
- Created missing API routes for search voice actors (`POST`), movies (`GET`/`POST`), and shows (`GET`/`POST`).
- Added RLS policies granting admin permissions for user reports.
- Removed legacy Deno Edge Functions and relocated generated database types to `packages/database/src/database.types.ts`.
- Decoupled `packages/shared-logic` from legacy edge function types.
- Fixed strict TypeScript typing across admin pages and media edit routes.
