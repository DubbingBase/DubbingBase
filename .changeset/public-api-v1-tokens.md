---
"@app/website": minor
"@app/supabase": minor
---

Add a public, token-authenticated REST API under `/api/v1` (voice actors: list, get, update). Routes are declared once with valibot schemas, which validate requests and responses and generate the OpenAPI document served at `/api/v1/openapi.json` and the reference at `/api/v1/docs`. Personal API tokens carry scopes, are stored hashed in the new `api_tokens` table, and are generated and managed by admins from the API Key tab of their profile.

Voice actor update conflicts now answer 409 immediately: `controlled_update_voice_actor` raises `PT409` instead of `40001`, which PostgREST retried until the gateway timed out.
