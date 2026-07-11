// Tests for the method-validation guard added to this function.
//
// Run with (from packages/database/supabase/functions):
//   deno test --allow-none --import-map=./_test_import_map.json find_duplicate_voice_actors/index.test.ts
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { __setMockContext } from "../_shared/test/mock_supabase_server.ts";
import handlerModule from "./index.ts";

function buildRequest(method: string): Request {
  return new Request("https://example.com/find_duplicate_voice_actors", {
    method,
  });
}

interface VoiceActorRow {
  id: string;
  firstname: string | null;
  lastname: string | null;
}

function makeSupabaseStub(actors: VoiceActorRow[]) {
  let served = false;
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            order(_col: string, _opts: { ascending: boolean }) {
              return {
                range(_start: number, _end: number) {
                  if (served) {
                    return Promise.resolve({ data: [], error: null });
                  }
                  served = true;
                  return Promise.resolve({ data: actors, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

Deno.test("find_duplicate_voice_actors - rejects unsupported HTTP methods with 405", async () => {
  __setMockContext({
    userClaims: { role: "admin" },
    supabase: makeSupabaseStub([]),
  });

  const res = await handlerModule.fetch(buildRequest("DELETE"));
  assertEquals(res.status, 405);
  const body = await res.json();
  assertEquals(body.error, "Method not allowed");
});

Deno.test("find_duplicate_voice_actors - accepts GET requests", async () => {
  __setMockContext({
    userClaims: { role: "admin" },
    supabase: makeSupabaseStub([]),
  });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 200);
});

Deno.test("find_duplicate_voice_actors - accepts POST requests", async () => {
  __setMockContext({
    userClaims: { role: "admin" },
    supabase: makeSupabaseStub([]),
  });

  const res = await handlerModule.fetch(buildRequest("POST"));
  assertEquals(res.status, 200);
});

Deno.test("find_duplicate_voice_actors - returns 401 when there are no user claims", async () => {
  __setMockContext({ userClaims: null, supabase: makeSupabaseStub([]) });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 401);
});

Deno.test("find_duplicate_voice_actors - returns 403 for non-admin users", async () => {
  __setMockContext({
    userClaims: { role: "user" },
    supabase: makeSupabaseStub([]),
  });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 403);
});

Deno.test("find_duplicate_voice_actors - groups actors with matching normalized names", async () => {
  const actors: VoiceActorRow[] = [
    { id: "1", firstname: "Jean", lastname: "Dupont" },
    { id: "2", firstname: "jean", lastname: "dupont" },
    { id: "3", firstname: "Émile", lastname: "Zola" },
  ];
  __setMockContext({
    userClaims: { role: "admin" },
    supabase: makeSupabaseStub(actors),
  });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 200);

  const data = await res.json();
  assertEquals(data.length, 1);
  assertExists(data[0].actors);
  assertEquals(data[0].actors.length, 2);
  assertEquals(
    data[0].actors.map((a: VoiceActorRow) => a.id).sort(),
    ["1", "2"],
  );
});

Deno.test("find_duplicate_voice_actors - returns an empty array when there are no duplicates", async () => {
  const actors: VoiceActorRow[] = [
    { id: "1", firstname: "Jean", lastname: "Dupont" },
    { id: "2", firstname: "Marie", lastname: "Curie" },
  ];
  __setMockContext({
    userClaims: { role: "admin" },
    supabase: makeSupabaseStub(actors),
  });

  const res = await handlerModule.fetch(buildRequest("GET"));
  const data = await res.json();
  assertEquals(data, []);
});