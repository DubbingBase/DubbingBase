// Test-only stand-in for the `npm:@supabase/server` package's `withSupabase`
// helper. Edge function tests remap the `npm:@supabase/server@^1` specifier
// to this module via `_test_import_map.json`, so the functions under test
// can be exercised without a real Supabase project, network access, or JWT
// verification.
//
// Usage in a test file:
//   import { __setMockContext } from "../_shared/test/mock_supabase_server.ts";
//   __setMockContext({ userClaims: { role: "admin" }, supabase: myStub });
//   const res = await handlerModule.fetch(new Request(...));

// deno-lint-ignore no-explicit-any
export interface MockContext {
  userClaims: any;
  supabase: any;
  supabaseAdmin: any;
}

const defaultContext: MockContext = {
  userClaims: null,
  supabase: null,
  supabaseAdmin: null,
};

let currentContext: MockContext = { ...defaultContext };

/** Configure the context object that will be passed to the next handler invocation(s). */
export function __setMockContext(ctx: Partial<MockContext>): void {
  currentContext = { ...defaultContext, ...ctx };
}

/** Reset the mock context back to its default (empty) state. */
export function __resetMockContext(): void {
  currentContext = { ...defaultContext };
}

// deno-lint-ignore no-explicit-any
export function withSupabase<_T = unknown>(
  _opts: { auth?: string },
  handler: (req: Request, ctx: MockContext) => Promise<Response> | Response,
): (req: Request) => Promise<Response> | Response {
  return (req: Request) => handler(req, currentContext);
}