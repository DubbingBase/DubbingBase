// Tests for the method-validation guard added to this function.
//
// Run with (from packages/database/supabase/functions):
//   deno test --allow-none --import-map=./_test_import_map.json list_users/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { __setMockContext } from "../_shared/test/mock_supabase_server.ts";
import handlerModule from "./index.ts";

function buildRequest(method: string): Request {
  return new Request("https://example.com/list_users", { method });
}

interface AuthUser {
  id: string;
  email?: string;
  is_anonymous?: boolean;
}

function makeSupabaseAdminStub(
  users: AuthUser[],
  error: { message: string } | null = null,
) {
  return {
    auth: {
      admin: {
        listUsers() {
          return Promise.resolve({ data: { users }, error });
        },
      },
    },
  };
}

Deno.test("list_users - rejects unsupported HTTP methods with 405", async () => {
  __setMockContext({
    userClaims: { role: "admin" },
    supabaseAdmin: makeSupabaseAdminStub([]),
  });

  const res = await handlerModule.fetch(buildRequest("DELETE"));
  assertEquals(res.status, 405);
  const body = await res.json();
  assertEquals(body.error, "Method not allowed");
});

Deno.test("list_users - accepts GET requests", async () => {
  __setMockContext({
    userClaims: { role: "admin" },
    supabaseAdmin: makeSupabaseAdminStub([]),
  });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 200);
});

Deno.test("list_users - accepts POST requests", async () => {
  __setMockContext({
    userClaims: { role: "admin" },
    supabaseAdmin: makeSupabaseAdminStub([]),
  });

  const res = await handlerModule.fetch(buildRequest("POST"));
  assertEquals(res.status, 200);
});

Deno.test("list_users - returns 401 when there are no user claims", async () => {
  __setMockContext({ userClaims: null, supabaseAdmin: makeSupabaseAdminStub([]) });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 401);
});

Deno.test("list_users - returns 403 for non-admin users", async () => {
  __setMockContext({
    userClaims: { role: "user" },
    supabaseAdmin: makeSupabaseAdminStub([]),
  });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 403);
});

Deno.test("list_users - excludes anonymous users and users without an email", async () => {
  const users: AuthUser[] = [
    { id: "1", email: "real@example.com", is_anonymous: false },
    { id: "2", email: undefined, is_anonymous: false },
    { id: "3", email: "anon@example.com", is_anonymous: true },
  ];
  __setMockContext({
    userClaims: { role: "admin" },
    supabaseAdmin: makeSupabaseAdminStub(users),
  });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(body.users.length, 1);
  assertEquals(body.users[0].id, "1");
});

Deno.test("list_users - returns 500 when the admin API errors", async () => {
  __setMockContext({
    userClaims: { role: "admin" },
    supabaseAdmin: makeSupabaseAdminStub([], { message: "boom" }),
  });

  const res = await handlerModule.fetch(buildRequest("GET"));
  assertEquals(res.status, 500);
});