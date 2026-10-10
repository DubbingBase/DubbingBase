import {
  createApp,
  createError,
  defineEventHandler,
  readMultipartFormData,
  toWebHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  useSupabaseAdmin: vi.fn(),
  buildSupabaseImageUrl: vi.fn((path: string) => `https://storage.test/${path}`),
}));

vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));
vi.mock("../urls/supabase", () => ({
  buildSupabaseImageUrl: routeMocks.buildSupabaseImageUrl,
}));

let handler: typeof import("../../api/upload-profile-picture.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readMultipartFormData", readMultipartFormData);
  handler = (await import("../../api/upload-profile-picture.post")).default;
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpgBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const webpBytes = Buffer.from("RIFF0000WEBP");
type User = { id: string; app_metadata?: { role?: string } } | null;
type MockOptions = {
  picture?: string | null;
  voiceActorExists?: boolean;
  selectError?: boolean;
  updateError?: boolean;
  updateReturnsNoRows?: boolean;
  uploadError?: boolean;
  removeError?: boolean;
  removeThrows?: boolean;
  limiter?: { success: boolean };
  limiterThrows?: boolean;
};

function createSupabaseMock(options: MockOptions = {}) {
  let picture = options.picture === undefined ? null : options.picture;
  const updateFilters: Array<[string, unknown]> = [];
  const upload = vi.fn(
    async (path: string, _data: Buffer, _options: { contentType: string; upsert: boolean }) =>
      options.uploadError
        ? { data: null, error: new Error("storage internals") }
        : { data: { path }, error: null },
  );
  const remove = vi.fn(async (_paths: string[]) => {
    if (options.removeThrows) throw new Error("remove failed");
    return {
      data: null,
      error: options.removeError ? new Error("remove failed") : null,
    };
  });
  const query = {
    select: vi.fn(() => query),
    update: vi.fn((values: { profile_picture: string }) => {
      query.updateValue = values.profile_picture;
      return query;
    }),
    updateValue: "",
    eq: vi.fn((column: string, value: unknown) => {
      updateFilters.push([column, value]);
      return query;
    }),
    is: vi.fn((column: string, value: unknown) => {
      updateFilters.push([column, value]);
      return query;
    }),
    maybeSingle: vi.fn(async () => ({
      data: options.voiceActorExists === false ? null : { id: 41, profile_picture: picture },
      error: options.selectError ? new Error("select failed") : null,
    })),
    then: undefined,
  };
  const updateQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      updateFilters.push([column, value]);
      return updateQuery;
    }),
    is: vi.fn((column: string, value: unknown) => {
      updateFilters.push([column, value]);
      return updateQuery;
    }),
    select: vi.fn(() => updateQuery),
    maybeSingle: vi.fn(async () => {
      if (options.updateError) return { data: null, error: new Error("database internals") };
      if (
        options.updateReturnsNoRows ||
        updateFilters.some(
          ([column, value]) =>
            column === "profile_picture" && (value === null ? picture !== null : picture !== value),
        )
      ) {
        return { data: null, error: null };
      }
      picture = query.updateValue;
      return { data: { id: 41 }, error: null };
    }),
  };
  const supabase = {
    from: vi.fn((name: string) => {
      if (name !== "voice_actors") throw new Error(`unexpected table ${name}`);
      return {
        ...query,
        update: vi.fn((values: { profile_picture: string }) => {
          query.updateValue = values.profile_picture;
          return updateQuery;
        }),
      };
    }),
    storage: { from: vi.fn(() => ({ upload, remove })) },
  };
  return { supabase, upload, remove, updateFilters, getPicture: () => picture };
}

async function post(
  options: {
    user?: User;
    picture?: string | null;
    bytes?: Buffer;
    type?: string;
    filename?: string;
    id?: string;
    includeFile?: boolean;
    mock?: MockOptions;
    cloudflare?: boolean;
  } = {},
) {
  const mocks = createSupabaseMock({
    picture: options.picture,
    ...options.mock,
  });
  routeMocks.useSupabaseAdmin.mockReturnValue(mocks.supabase);
  const limiter = vi.fn(async () => options.mock?.limiter ?? { success: true });
  const form = new FormData();
  if (options.includeFile !== false) {
    form.append(
      "file",
      new Blob([options.bytes ?? pngBytes], {
        type: options.type ?? "image/png",
      }),
      options.filename ?? "profile.png",
    );
  }
  form.append("voice_actor_id", options.id ?? "41");
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.user = options.user;
      if (options.cloudflare)
        event.context.cloudflare = {
          env: { PROFILE_PICTURE_UPLOAD_LIMITER: { limit: limiter } },
        };
      return handler(event);
    }),
  );
  const response = await toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      body: form,
      headers: { "cf-connecting-ip": "192.0.2.1" },
    }),
  );
  return { ...mocks, response, limiter };
}

describe("POST /api/upload-profile-picture", () => {
  it.each([null, ""])(
    "allows anonymous first upload when current picture is %s",
    async (picture) => {
      const { response, upload } = await post({ user: null, picture });
      expect(response.status).toBe(200);
      expect(upload).toHaveBeenCalledOnce();
    },
  );

  it("allows a regular user's first upload", async () => {
    const { response } = await post({ user: { id: "user-1" } });
    expect(response.status).toBe(200);
  });

  it.each([null, { id: "user-1" }])("denies non-admin replacement", async (user) => {
    const { response, upload } = await post({ user, picture: "41/old.png" });
    expect(response.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });

  it("does not grant replacement permission based on a voice actor link", async () => {
    const { response, upload } = await post({
      user: { id: "linked-user" },
      picture: "41.jpg",
    });
    expect(response.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });

  it("allows an admin to replace and removes an attributable old path", async () => {
    const { response, upload, remove } = await post({
      user: { id: "admin", app_metadata: { role: "admin" } },
      picture: "41.jpg",
    });
    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalledWith(["41.jpg"]);
    expect(upload.mock.calls[0][2]).toEqual({
      contentType: "image/png",
      upsert: false,
    });
  });

  it.each([
    ["image/jpeg", jpgBytes, "jpg"],
    ["image/png", pngBytes, "png"],
    ["image/webp", webpBytes, "webp"],
  ] as const)(
    "preserves %s and derives .%s from validated bytes",
    async (type, bytes, extension) => {
      const { response, upload } = await post({
        user: null,
        type,
        bytes,
        filename: "portrait.svg",
      });
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.fullPath).toMatch(new RegExp(`^41/.+\\.${extension}$`));
      expect(upload.mock.calls[0][2]).toEqual({
        contentType: type,
        upsert: false,
      });
    },
  );

  it.each([
    { name: "bad signature", type: "image/png", bytes: jpgBytes, status: 415 },
    {
      name: "unsupported MIME",
      type: "image/svg+xml",
      bytes: Buffer.from("<svg/>"),
      status: 415,
    },
    {
      name: "oversized file",
      type: "image/png",
      bytes: Buffer.alloc(5 * 1024 * 1024 + 1),
      status: 413,
    },
    { name: "invalid ID", id: "1.5", status: 400 },
    { name: "missing file", includeFile: false, status: 400 },
  ])("rejects $name before storage", async ({ status, ...input }) => {
    const { response, upload } = await post(input);
    expect(response.status).toBe(status);
    expect(upload).not.toHaveBeenCalled();
  });

  it("accepts the 5 MiB limit", async () => {
    const { response } = await post({
      bytes: Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(5 * 1024 * 1024 - 8),
      ]),
    });
    expect(response.status).toBe(200);
  });

  it("rejects an unavailable actor and read errors without uploading", async () => {
    const missing = await post({ mock: { voiceActorExists: false } });
    expect(missing.response.status).toBe(404);
    const failed = await post({ mock: { selectError: true } });
    expect(failed.response.status).toBe(500);
    expect(failed.upload).not.toHaveBeenCalled();
  });

  it("returns a bounded error when storage rejects an upload", async () => {
    const { response, remove } = await post({ mock: { uploadError: true } });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("storage internals");
    expect(remove).not.toHaveBeenCalled();
  });

  it("cleans up after a failed database update", async () => {
    const { response, upload, remove } = await post({
      mock: { updateError: true },
    });
    expect(response.status).toBe(500);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });

  it("returns 409 and cleans up when the conditional first-upload update loses", async () => {
    const { response, upload, remove, updateFilters } = await post({
      mock: { updateReturnsNoRows: true },
    });
    expect(response.status).toBe(409);
    expect(updateFilters).toContainEqual(["profile_picture", null]);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });

  it("keeps the successful response when staged or previous-file cleanup fails", async () => {
    const updateFailed = await post({
      mock: { updateReturnsNoRows: true, removeThrows: true },
    });
    expect(updateFailed.response.status).toBe(409);
    const replaced = await post({
      user: { id: "admin", app_metadata: { role: "admin" } },
      picture: "41.jpg",
      mock: { removeThrows: true },
    });
    expect(replaced.response.status).toBe(200);
  });

  it("does not delete a previous image outside the actor's attributable path", async () => {
    const { response, remove } = await post({
      user: { id: "admin", app_metadata: { role: "admin" } },
      picture: "untrusted/other.png",
    });
    expect(response.status).toBe(200);
    expect(remove).not.toHaveBeenCalledWith(["untrusted/other.png"]);
  });

  it("applies the public rate limit and rejects over-limit requests", async () => {
    const { response, upload, limiter } = await post({
      cloudflare: true,
      mock: { limiter: { success: false } },
    });
    expect(response.status).toBe(429);
    expect(limiter).toHaveBeenCalledWith({
      key: "voice-actor-picture-upload:192.0.2.1",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("allows exactly one of two simultaneous first uploads", async () => {
    let picture: string | null = null;
    let reads = 0;
    let releaseReads: (() => void) | undefined;
    const readGate = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    const staged: string[] = [];
    const removals: string[][] = [];
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: async () => {
              reads += 1;
              const snapshot = picture;
              if (reads === 2) releaseReads?.();
              await readGate;
              return {
                data: { id: 41, profile_picture: snapshot },
                error: null,
              };
            },
          })),
        })),
        update: vi.fn((values: { profile_picture: string }) => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: async () => {
                  if (picture !== null) return { data: null, error: null };
                  picture = values.profile_picture;
                  return { data: { id: 41 }, error: null };
                },
              })),
            })),
          })),
        })),
      })),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async (path: string) => {
            staged.push(path);
            return { data: { path }, error: null };
          }),
          remove: vi.fn(async (paths: string[]) => {
            removals.push(paths);
            return { data: null, error: null };
          }),
        })),
      },
    };
    routeMocks.useSupabaseAdmin.mockReturnValue(supabase);
    const submit = async () => {
      const form = new FormData();
      form.append("file", new Blob([pngBytes], { type: "image/png" }), "a.png");
      form.append("voice_actor_id", "41");
      const app = createApp();
      app.use(
        "/",
        defineEventHandler((event) => handler(event)),
      );
      return toWebHandler(app)(new Request("http://localhost/", { method: "POST", body: form }));
    };
    const responses = await Promise.all([submit(), submit()]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(staged).toHaveLength(2);
    expect(removals).toHaveLength(1);
    expect(removals[0]).toContain(staged.find((path) => path !== picture));
  });
});
