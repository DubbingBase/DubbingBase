import {
  createApp,
  createError,
  defineEventHandler,
  getQuery,
  toWebHandler,
} from "h3";
import type { PaginatedResponse } from "@app/shared-logic";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let handler: typeof import("../api/detail-collections.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  handler = (await import("../api/detail-collections.get")).default;
});

afterAll(() => vi.unstubAllGlobals());

async function requestCollection(
  query: URLSearchParams,
  fetchData: (path: string) => Promise<Record<string, unknown>>,
): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      Object.defineProperty(event, "$fetch", { value: fetchData });
      return handler(event);
    }),
  );

  return await toWebHandler(app)(
    new Request(`http://localhost/?${query.toString()}`),
  );
}

describe("GET /api/detail-collections", () => {
  it("keeps generic pagination for other collection types", async () => {
    const projects = Array.from({ length: 13 }, (_, index) => ({
      id: index + 1,
      title: `Project ${index + 1}`,
    }));
    const fetchData = async () => ({ dubbedProjects: projects });
    const response = await requestCollection(
      new URLSearchParams({
        collection: "studio-projects",
        id: "studio-1",
        page: "1",
        pageSize: "12",
      }),
      fetchData,
    );
    const body: PaginatedResponse<{ id: number; title: string }> =
      await response.json();

    expect(body.data).toHaveLength(12);
    expect(body.pagination).toMatchObject({
      page: 1,
      pageSize: 12,
      totalItems: 13,
      totalPages: 2,
    });
  });
});
