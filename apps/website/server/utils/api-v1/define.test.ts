import { createApp, createRouter, toWebHandler } from "h3";
import * as v from "valibot";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiScope } from "../../../shared/api-scopes";

const mocks = vi.hoisted(() => ({ authenticateApiToken: vi.fn() }));

vi.mock("./tokens", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./tokens")>()),
  authenticateApiToken: mocks.authenticateApiToken,
}));

import { defineApiRoute, operationFor } from "./define";

beforeEach(() => vi.clearAllMocks());

const route = defineApiRoute({
  summary: "Echo",
  tags: ["Test"],
  scope: "voice-actors:write",
  idempotent: true,
  params: v.object({ id: v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number)) }),
  query: v.object({}),
  body: v.strictObject({ name: v.pipe(v.string(), v.minLength(1)) }),
  response: v.object({ id: v.number(), name: v.string() }),
  handler: ({ params, body, idempotencyKey }) => ({
    id: params.id,
    name: body.name,
    leaked: idempotencyKey,
  }),
});

const handle = toWebHandler(
  (() => {
    const app = createApp();
    const router = createRouter();
    router.patch("/things/:id", route.handler);
    app.use(router);
    return app;
  })(),
);

const KEY = "11111111-1111-4111-8111-111111111111";

function call(options: { token?: string; key?: string | null; body?: unknown; id?: string }) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.key !== null) headers["idempotency-key"] = options.key ?? KEY;
  return handle(
    new Request(`http://localhost/things/${options.id ?? "7"}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(options.body ?? { name: "x" }),
    }),
  );
}

function principal(scopes: ApiScope[]) {
  mocks.authenticateApiToken.mockResolvedValue({
    tokenId: crypto.randomUUID(),
    userId: "u",
    scopes,
  });
}

describe("defineApiRoute", () => {
  it("rate limits a client address before looking the token up", async () => {
    const limited = (ip: string) =>
      handle(
        new Request("http://localhost/things/7", {
          method: "PATCH",
          headers: { authorization: "Bearer dbk_live_x", "cf-connecting-ip": ip },
        }),
      );
    mocks.authenticateApiToken.mockResolvedValue(null);
    let status = 0;
    for (let i = 0; i < 601; i += 1) status = (await limited("192.0.2.77")).status;
    expect(status).toBe(429);
    expect(mocks.authenticateApiToken).toHaveBeenCalledTimes(600);
  });

  it("rejects a missing or non-API token with 401 and WWW-Authenticate", async () => {
    const none = await call({});
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toContain("Bearer");
    const foreign = await call({ token: "eyJhbGciOi.jwt.like" });
    expect(foreign.status).toBe(401);
    expect(mocks.authenticateApiToken).not.toHaveBeenCalled();
  });

  it("rejects an unknown token with 401", async () => {
    mocks.authenticateApiToken.mockResolvedValue(null);
    expect((await call({ token: "dbk_live_nope" })).status).toBe(401);
  });

  it("rejects a token without the required scope with 403", async () => {
    principal(["voice-actors:read"]);
    const response = await call({ token: "dbk_live_x" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "insufficient_scope", message: expect.any(String) },
    });
  });

  it("validates params, body and the idempotency key before running the handler", async () => {
    principal(["voice-actors:write"]);
    expect((await call({ token: "dbk_live_x", id: "abc" })).status).toBe(400);
    expect((await call({ token: "dbk_live_x", body: { name: "" } })).status).toBe(400);
    expect((await call({ token: "dbk_live_x", body: { name: "x", extra: 1 } })).status).toBe(400);
    expect((await call({ token: "dbk_live_x", key: "not-a-uuid" })).status).toBe(400);
  });

  it("generates an idempotency key when the client sends none", async () => {
    principal(["voice-actors:write"]);
    expect((await call({ token: "dbk_live_x", key: null })).status).toBe(200);
  });

  it("runs the handler, strips fields outside the response schema and disables caching", async () => {
    principal(["voice-actors:write"]);
    const response = await call({ token: "dbk_live_x", body: { name: "Ada" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(await response.json()).toEqual({ id: 7, name: "Ada" });
  });

  it("documents scope, body, idempotency and error responses in the OpenAPI operation", () => {
    const operation = operationFor(route.docs, {});
    expect(operation.security).toEqual([{ bearerAuth: ["voice-actors:write"] }]);
    expect(operation.requestBody).toBeDefined();
    expect(operation.parameters.map((parameter) => parameter.name)).toEqual([
      "id",
      "Idempotency-Key",
    ]);
    expect(Object.keys(operation.responses)).toEqual(["200", "400", "401", "403", "429"]);
  });

  it("hoists recursive schema definitions into components so $refs resolve", () => {
    type Tree = { name: string; children: Tree[] };
    const Tree: v.GenericSchema<Tree> = v.object({
      name: v.string(),
      children: v.array(v.lazy(() => Tree)),
    });
    const recursive = defineApiRoute({
      summary: "Tree",
      tags: ["Test"],
      scope: "voice-actors:read",
      params: v.object({}),
      query: v.object({}),
      response: Tree,
      handler: () => ({ name: "root", children: [] }),
    });
    const components: Record<string, unknown> = {};
    const operation = operationFor(recursive.docs, components);
    const text = JSON.stringify(operation);
    expect(text).not.toContain("#/$defs/");
    const refs = [...text.matchAll(/#\/components\/schemas\/([\w-]+)/g)].map((m) => m[1] ?? "");
    expect(refs.length).toBeGreaterThan(0);
    for (const name of refs) expect(Object.keys(components)).toContain(name);
  });
});
