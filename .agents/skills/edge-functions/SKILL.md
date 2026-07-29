---
name: edge-functions
description: Project-specific rules and gotchas for creating and modifying Supabase Edge Functions in DubbingBase. Trigger when writing or debugging any edge function, or when considering where to place data fetching logic.
---

# DubbingBase Edge Functions: Rules & Gotchas

This project relies heavily on Supabase Edge Functions for all backend logic, data fetching, and external API calls. Follow these strict rules and conventions when creating or modifying them.

## 1. No Inline Supabase Calls from the Frontend

- **CRITICAL RULE**: Do not use `supabase.from(...)` directly inside Vue components (whether in `apps/website` or `apps/mobile`).
- **Always** use Edge Functions for queries and mutations.
- In the frontend, invoke them via `supabase.functions.invoke("function-name", { body: { ... } })`.

## 2. Environment & Syntax

- **Deno & TypeScript**: Edge Functions are written in TypeScript for Deno.
- **No Import Map**: The `import_map.json` file has been deleted. You must import dependencies directly from standard URLs (e.g., `npm:`, `jsr:`, `https://esm.sh/...`).
  - Example: `import { withSupabase } from "npm:@supabase/server@^1";`
  - Example: `import "jsr:@supabase/functions-js/edge-runtime.d.ts";`

## 3. Creating a New Function

- **Directory Structure**: Create your function under `packages/database/supabase/functions/<function-name>/index.ts`.
- **`withSupabase` Wrapper**: Always wrap your fetch handler in `withSupabase` from `@supabase/server`.
  - Provide an `auth` configuration based on the endpoint's purpose (e.g., `auth: "user"` for authenticated users, `auth: "publishable:*"` for public access, `auth: "secret"` for internal services).
- **HTTP Utilities**: Use the shared utility functions from `../_shared/http-utils.ts` (e.g., `createResponse`, `createErrorResponse`) if you need consistent responses with CORS headers, or just use `Response.json(...)` as `withSupabase` handles CORS automatically.

## 4. Configuration (`config.toml`)

- **`verify_jwt`**: If you create a new public or secret endpoint (i.e. anything other than `auth: "user"`), you **must** add it to `packages/database/supabase/config.toml` and disable JWT verification.
  ```toml
  [functions.my-function-name]
  verify_jwt = false
  ```
- Failure to do this will cause the function to reject requests with a `401 Unauthorized` before your code even runs.

## 5. Payloads & Error Handling

- Use `await req.json()` to parse incoming JSON payloads.
- Always validate inputs. If a required field is missing, return a `400 Bad Request` using `createErrorResponse("Missing field", 400)` or `Response.json({ error: "Missing field" }, { status: 400 })`.
- Catch all errors in a `try/catch` block and return a `500 Internal Server Error` to avoid leaking sensitive stack traces to the client.

## 6. Shared Code

- Shared types and utility classes (like `DatabaseClient` or `MediaService`) live in `packages/database/supabase/functions/_shared/`.
- Import the generated Database types from `../_shared/database.types.ts`.
- If you change the database schema, remember to run `mise run gen-types` to update the types.
