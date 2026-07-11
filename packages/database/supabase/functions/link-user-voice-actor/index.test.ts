// Tests for the request-body parsing/fallback logic and validation added
// to this function:
//   const user_id = body.user_id || body.targetUserId || user.id;
//   const voice_actor_id = body.voice_actor_id;
//   if (!user_id || !voice_actor_id) return 400;
//
// Run with (from packages/database/supabase/functions):
//   deno test --allow-none --import-map=./_test_import_map.json link-user-voice-actor/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { __setMockContext } from "../_shared/test/mock_supabase_server.ts";
import handlerModule from "./index.ts";

function buildRequest(body: unknown): Request {
  return new Request("https://example.com/link-user-voice-actor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface StubOptions {
  voiceActorExists?: boolean;
  existingLink?: boolean;
}

function makeSupabaseStub(opts: StubOptions = {}) {
  const calls: { insert: Record<string, unknown> | null } = { insert: null };

  const stub = {
    calls,
    // deno-lint-ignore no-explicit-any
    from(table: string): any {
      if (table === "voice_actors") {
        return {
          select() {
            return {
              eq(_col: string, value: unknown) {
                return {
                  single() {
                    if (opts.voiceActorExists === false) {
                      return Promise.resolve({
                        data: null,
                        error: { message: "not found" },
                      });
                    }
                    return Promise.resolve({ data: { id: value }, error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "user_voice_actor_links") {
        return {
          select() {
            return {
              eq(_c1: string, _v1: unknown) {
                return {
                  eq(_c2: string, _v2: unknown) {
                    return {
                      single() {
                        if (opts.existingLink) {
                          return Promise.resolve({ data: { id: 1 }, error: null });
                        }
                        return Promise.resolve({
                          data: null,
                          error: { code: "PGRST116", message: "no rows" },
                        });
                      },
                    };
                  },
                };
              },
            };
          },
          insert(payload: Record<string, unknown>) {
            calls.insert = payload;
            return Promise.resolve({ error: null });
          },
        };
      }

      throw new Error(`Unexpected table requested in test stub: ${table}`);
    },
  };

  return stub;
}

Deno.test("link-user-voice-actor - uses user_id from the request body when provided", async () => {
  const stub = makeSupabaseStub();
  __setMockContext({
    userClaims: { id: "admin-1", role: "admin" },
    supabase: stub,
  });

  const res = await handlerModule.fetch(
    buildRequest({ user_id: "user-42", voice_actor_id: 7 }),
  );

  assertEquals(res.status, 200);
  assertEquals(stub.calls.insert, { user_id: "user-42", voice_actor_id: 7 });
});

Deno.test("link-user-voice-actor - falls back to targetUserId when user_id is absent", async () => {
  const stub = makeSupabaseStub();
  __setMockContext({
    userClaims: { id: "admin-1", role: "admin" },
    supabase: stub,
  });

  const res = await handlerModule.fetch(
    buildRequest({ targetUserId: "user-99", voice_actor_id: 7 }),
  );

  assertEquals(res.status, 200);
  assertEquals(stub.calls.insert, { user_id: "user-99", voice_actor_id: 7 });
});

Deno.test("link-user-voice-actor - falls back to the authenticated user's own id as a last resort", async () => {
  const stub = makeSupabaseStub();
  __setMockContext({
    userClaims: { id: "admin-1", role: "admin" },
    supabase: stub,
  });

  const res = await handlerModule.fetch(buildRequest({ voice_actor_id: 7 }));

  assertEquals(res.status, 200);
  assertEquals(stub.calls.insert, { user_id: "admin-1", voice_actor_id: 7 });
});

Deno.test("link-user-voice-actor - prefers explicit user_id over targetUserId and the caller's id", async () => {
  const stub = makeSupabaseStub();
  __setMockContext({
    userClaims: { id: "admin-1", role: "admin" },
    supabase: stub,
  });

  const res = await handlerModule.fetch(
    buildRequest({ user_id: "user-1", targetUserId: "user-2", voice_actor_id: 7 }),
  );

  assertEquals(res.status, 200);
  assertEquals(stub.calls.insert, { user_id: "user-1", voice_actor_id: 7 });
});

Deno.test("link-user-voice-actor - returns 400 when voice_actor_id is missing", async () => {
  const stub = makeSupabaseStub();
  __setMockContext({
    userClaims: { id: "admin-1", role: "admin" },
    supabase: stub,
  });

  const res = await handlerModule.fetch(buildRequest({ user_id: "user-42" }));

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "Missing user_id or voice_actor_id");
  assertEquals(stub.calls.insert, null);
});

Deno.test("link-user-voice-actor - returns 400 when no user id can be resolved at all", async () => {
  const stub = makeSupabaseStub();
  // No id on the authenticated user claims, and none supplied in the body.
  __setMockContext({
    userClaims: { role: "admin" },
    supabase: stub,
  });

  const res = await handlerModule.fetch(buildRequest({ voice_actor_id: 7 }));

  assertEquals(res.status, 400);
  assertEquals(stub.calls.insert, null);
});

Deno.test("link-user-voice-actor - returns 404 when the voice actor does not exist", async () => {
  const stub = makeSupabaseStub({ voiceActorExists: false });
  __setMockContext({
    userClaims: { id: "admin-1", role: "admin" },
    supabase: stub,
  });

  const res = await handlerModule.fetch(
    buildRequest({ user_id: "user-42", voice_actor_id: 999 }),
  );

  assertEquals(res.status, 404);
});

Deno.test("link-user-voice-actor - returns 400 when the link already exists", async () => {
  const stub = makeSupabaseStub({ existingLink: true });
  __setMockContext({
    userClaims: { id: "admin-1", role: "admin" },
    supabase: stub,
  });

  const res = await handlerModule.fetch(
    buildRequest({ user_id: "user-42", voice_actor_id: 7 }),
  );

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "User is already linked to this voice actor");
});