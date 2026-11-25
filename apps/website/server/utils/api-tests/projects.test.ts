import { createApp, createRouter, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiScope } from "../../../shared/api-scopes";

const routeMocks = vi.hoisted(() => ({
  authenticateApiToken: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../api-v1/tokens", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api-v1/tokens")>()),
  authenticateApiToken: routeMocks.authenticateApiToken,
}));
vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));

type QueryResult = { data: unknown; error: null };

class Query implements PromiseLike<QueryResult> {
  constructor(private readonly value: unknown) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  order() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve({
      data: Array.isArray(this.value) ? (this.value[0] ?? null) : this.value,
      error: null,
    });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.value, error: null }).then(onfulfilled, onrejected);
  }
}

const media = { id: 501, kind: "movie", content_id: 501 };
const projectRow = {
  id: 71,
  language: "fr-FR",
  studio_id: 9,
  status: "pending",
  media,
};

let handle: (request: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  const [mediaRoute, createProjectRoute, getProjectRoute, updateProjectRoute] = await Promise.all([
    import("../../api/v1/[type]/[id]/index.get"),
    import("../../api/v1/[type]/[id]/projects/index.post"),
    import("../../api/v1/projects/[projectId].get"),
    import("../../api/v1/projects/[projectId].patch"),
  ]);
  const router = createRouter();
  router.get("/:type/:id", mediaRoute.default);
  router.post("/:type/:id/projects", createProjectRoute.default);
  router.get("/projects/:projectId", getProjectRoute.default);
  router.patch("/projects/:projectId", updateProjectRoute.default);
  const app = createApp();
  app.use(router);
  handle = toWebHandler(app);
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.authenticateApiToken.mockResolvedValue({
    tokenId: "token",
    userId: "admin-user",
    scopes: ["credits:read", "credits:create", "credits:update"] satisfies ApiScope[],
  });
  routeMocks.from.mockImplementation((table: string) => {
    const data = table === "media" ? media : table === "dubbing_projects" ? [projectRow] : null;
    return new Query(data);
  });
  routeMocks.useSupabaseAdmin.mockImplementation(() => ({
    from: routeMocks.from,
    rpc: routeMocks.rpc,
  }));
});

afterAll(() => vi.unstubAllGlobals());

function request(path: string, method: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { authorization: "Bearer dbk_live_test" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET") headers["idempotency-key"] = "11111111-1111-4111-8111-111111111111";
  return handle(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

describe("API v1 dubbing projects", () => {
  it("keeps media languages and adds the project links", async () => {
    const response = await request("/movies/501", "GET");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      languages: ["fr-FR"],
      projects: [{ id: 71, language: "fr-FR", path: "/api/v1/projects/71" }],
    });
  });

  it("ensures a provider-backed project without making a media lookup", async () => {
    routeMocks.rpc.mockResolvedValue({
      data: [{ project_id: 71, language: "fr-FR", audit_log_id: null, replayed: false }],
      error: null,
    });

    const response = await request("/movies/501/projects", "POST", { language: "fr-FR" });

    expect(response.status).toBe(200);
    expect(routeMocks.from).not.toHaveBeenCalled();
    expect(routeMocks.rpc).toHaveBeenCalledWith("api_create_dubbing_project", {
      p_actor_id: "admin-user",
      p_request_id: "11111111-1111-4111-8111-111111111111",
      p_content_id: 501,
      p_content_type: "movie",
      p_language: "fr-FR",
    });
    await expect(response.json()).resolves.toEqual({
      id: 71,
      language: "fr-FR",
      path: "/api/v1/projects/71",
      replayed: false,
    });
  });

  it.each(["toys", "advertisements"])(
    "keeps missing %s as a 404 instead of creating it",
    async (type) => {
      routeMocks.from.mockImplementation(
        (table: string) => new Query(table === "media" ? null : [projectRow]),
      );

      const response = await request(`/${type}/77/projects`, "POST", { language: "fr-FR" });

      expect(response.status).toBe(404);
      expect(routeMocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("returns a project detail with a media link", async () => {
    const response = await request("/projects/71", "GET");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: 71,
      path: "/api/v1/projects/71",
      language: "fr-FR",
      studio_id: 9,
      status: "pending",
      media: { path: "/api/v1/movies/501", type: "movies", id: 501 },
    });
  });

  it("patches only the allowed fields and returns the RPC's atomic project row", async () => {
    routeMocks.rpc.mockResolvedValue({
      data: {
        id: 71,
        language: "fr-FR",
        studio_id: null,
        status: "validated",
        media: { kind: "movie", content_id: 501 },
        changed: true,
        replayed: false,
      },
      error: null,
    });

    const response = await request("/projects/71", "PATCH", {
      status: "validated",
      studio_id: null,
    });

    expect(response.status).toBe(200);
    expect(routeMocks.rpc).toHaveBeenCalledWith("api_update_dubbing_project", {
      p_actor_id: "admin-user",
      p_request_id: "11111111-1111-4111-8111-111111111111",
      p_project_id: 71,
      p_updates: { status: "validated", studio_id: null },
    });
    expect(routeMocks.from).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      id: 71,
      language: "fr-FR",
      status: "validated",
      studio_id: null,
      media: { path: "/api/v1/movies/501", type: "movies", id: 501 },
    });
  });

  it("rejects empty updates and fields outside the project PATCH allowlist", async () => {
    const empty = await request("/projects/71", "PATCH", {});
    const protectedField = await request("/projects/71", "PATCH", { language: "fr-CA" });
    const invalidStudio = await request("/projects/71", "PATCH", { studio_id: "9" });

    expect(empty.status).toBe(400);
    expect(protectedField.status).toBe(400);
    expect(invalidStudio.status).toBe(400);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });
});
