// Tests for the method-validation guard added to this function.
//
// Run with (from packages/database/supabase/functions):
//   deno test --allow-none --import-map=./_test_import_map.json find_duplicate_work/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { __setMockContext } from "../_shared/test/mock_supabase_server.ts";
import handlerModule from "./index.ts";

function buildRequest(method: string): Request {
  return new Request("https://example.com/find_duplicate_work", { method });
}

interface WorkRow {
  id: number;
  content_id: number;
  actor_id: number;
  voice_actor_id: number | null;
  status?: string | null;
  performance?: string | null;
  content_type?: string | null;
}

function makeSupabaseStub(works: WorkRow[]) {
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
                  return Promise.resolve({ data: works, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

Deno.test("find_duplicate_work - rejects unsupported HTTP methods with 405", async () => {
  __setMockContext({ userClaims: { role: "admin" }, supabase: makeSupabaseStub([]) });

  const res = await handlerModule.fetch(buildRequest("PUT"));
  assertEquals(res.status, 405);
  const body = await res.json();
  assertEquals(body.error, "Method not allowed");
});

Deno.test("find_duplicate_work - accepts GET requests", async () => {
  __setMockContext({ userClaims: { role: "admin" }, supabase: makeSupabaseStub([]) });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 200);
});

Deno.test("find_duplicate_work - accepts POST requests", async () => {
  __setMockContext({ userClaims: { role: "admin" }, supabase: makeSupabaseStub([]) });

  const res = await handlerModule.fetch(buildRequest("POST"));
  assertEquals(res.status, 200);
});

Deno.test("find_duplicate_work - returns 401 when there are no user claims", async () => {
  __setMockContext({ userClaims: null, supabase: makeSupabaseStub([]) });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 401);
});

Deno.test("find_duplicate_work - returns 403 for non-admin users", async () => {
  __setMockContext({ userClaims: { role: "user" }, supabase: makeSupabaseStub([]) });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 403);
});

Deno.test("find_duplicate_work - groups rows sharing content_id/actor_id/voice_actor_id", async () => {
  const works: WorkRow[] = [
    { id: 1, content_id: 10, actor_id: 100, voice_actor_id: 200, status: "approved", performance: "Bob", content_type: "movie" },
    { id: 2, content_id: 10, actor_id: 100, voice_actor_id: 200, status: "waiting", performance: "Bob", content_type: "movie" },
    { id: 3, content_id: 11, actor_id: 101, voice_actor_id: 201, status: "accepted", performance: "Alice", content_type: "tv" },
  ];
  __setMockContext({ userClaims: { role: "admin" }, supabase: makeSupabaseStub(works) });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 200);

  const data = await res.json();
  assertEquals(data.length, 1);
  assertEquals(data[0].works.map((w: WorkRow) => w.id).sort(), [1, 2]);
});

Deno.test("find_duplicate_work - treats null voice_actor_id as a shared group key", async () => {
  const works: WorkRow[] = [
    { id: 1, content_id: 20, actor_id: 200, voice_actor_id: null },
    { id: 2, content_id: 20, actor_id: 200, voice_actor_id: null },
  ];
  __setMockContext({ userClaims: { role: "admin" }, supabase: makeSupabaseStub(works) });

  const res = await handlerModule.fetch(buildRequest("GET"));
  const data = await res.json();
  assertEquals(data.length, 1);
  assertEquals(data[0].works.length, 2);
});

Deno.test("find_duplicate_work - returns an empty array when there are no duplicates", async () => {
  const works: WorkRow[] = [
    { id: 1, content_id: 10, actor_id: 100, voice_actor_id: 200 },
    { id: 2, content_id: 11, actor_id: 101, voice_actor_id: 201 },
  ];
  __setMockContext({ userClaims: { role: "admin" }, supabase: makeSupabaseStub(works) });

  const res = await handlerModule.fetch(buildRequest("GET"));
  const data = await res.json();
  assertEquals(data, []);
});