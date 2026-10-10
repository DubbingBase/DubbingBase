import {
  createApp,
  createError,
  defineEventHandler,
  readMultipartFormData,
  toWebHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  useSupabaseAdmin: vi.fn(),
  buildSupabaseImageUrl: vi.fn((path: string) => `https://storage.test/${path}`),
}));

vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
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

type MockOptions = {
  linked?: boolean;
  voiceActorExists?: boolean;
  updateSucceeds?: boolean;
  updateReturnsNoRows?: boolean;
  uploadSucceeds?: boolean;
};

function createSupabaseMock(options: MockOptions = {}) {
  const actor = { id: 41, profile_picture: "41/old.png" };
  const upload = vi.fn(
    async (path: string, _data: Buffer, _options: { contentType: string; upsert: boolean }) =>
      options.uploadSucceeds === false
        ? { data: null, error: new Error("storage internals") }
        : { data: { path }, error: null },
  );
  const remove = vi.fn(async (_paths: string[]) => ({
    data: null,
    error: null,
  }));
  let operation = "select";
  let table = "";
  const supabase = {
    from: vi.fn((name: string) => {
      table = name;
      operation = "select";
      const query = {
        select: vi.fn(() => query),
        update: vi.fn(() => {
          operation = "update";
          return query;
        }),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => {
          if (table === "voice_actors" && operation === "update") {
            return options.updateSucceeds === false || options.updateReturnsNoRows
              ? { data: null, error: new Error("database internals") }
              : { data: { id: 41 }, error: null };
          }
          if (table === "voice_actors") {
            return options.voiceActorExists === false
              ? { data: null, error: null }
              : { data: actor, error: null };
          }
          return options.linked === false
            ? { data: null, error: null }
            : { data: { voice_actor_id: 41 }, error: null };
        }),
      };
      return query;
    }),
    storage: {
      from: vi.fn(() => ({ upload, remove })),
    },
  };
  return { supabase, upload, remove };
}

async function post(
  options: {
    user?: { id: string; app_metadata?: { role?: string } } | null;
    id?: string;
    bytes?: Buffer;
    type?: string;
    filename?: string;
    includeFile?: boolean;
    mock?: MockOptions;
  } = {},
): Promise<{
  response: Response;
  upload: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}> {
  const { supabase, upload, remove } = createSupabaseMock(options.mock);
  routeMocks.useSupabaseAdmin.mockReturnValue(supabase);
  routeMocks.requireUser.mockImplementation((event: { context: { user?: unknown } }) => {
    if (!event.context.user) throw createError({ statusCode: 401, message: "Unauthorized" });
    return event.context.user;
  });

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
      event.context.user = options.user === undefined ? { id: "user-1" } : options.user;
      return handler(event);
    }),
  );
  const response = await toWebHandler(app)(
    new Request("http://localhost/", { method: "POST", body: form }),
  );
  return { response, upload, remove };
}

describe("POST /api/upload-profile-picture", () => {
  it("rejects anonymous users before reading or accessing storage", async () => {
    const { response, upload } = await post({ user: null });
    expect(response.status).toBe(401);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects users without a matching voice actor link before upload", async () => {
    const { response, upload } = await post({ mock: { linked: false } });
    expect(response.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([
    ["image/jpeg", jpgBytes, "jpg"],
    ["image/png", pngBytes, "png"],
    ["image/webp", webpBytes, "webp"],
  ])(
    "lets admins upload verified %s using its MIME type and derived extension",
    async (type, bytes, extension) => {
      const { response, upload, remove } = await post({
        user: { id: "admin", app_metadata: { role: "admin" } },
        type,
        bytes,
        filename: "portrait.svg",
      });

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.ok).toBe(true);
      expect(payload.fullPath).toMatch(new RegExp(`^41/.+\\.${extension}$`));
      expect(payload.publicUrl).toBe(`https://storage.test/${payload.fullPath}`);
      expect(upload).toHaveBeenCalledWith(
        payload.fullPath,
        bytes,
        expect.objectContaining({ contentType: type, upsert: false }),
      );
      expect(remove).toHaveBeenCalledWith(["41/old.png"]);
    },
  );

  it("lets a user linked to the matching voice actor upload the picture", async () => {
    const { response, upload } = await post({ mock: { linked: true } });
    expect(response.status).toBe(200);
    expect(upload).toHaveBeenCalledOnce();
  });

  it.each([
    { name: "malformed ID", id: "1.5", status: 400 },
    { name: "missing file", includeFile: false, status: 400 },
    {
      name: "unsupported declared MIME",
      type: "image/svg+xml",
      bytes: Buffer.from("<svg/>", "utf8"),
      status: 415,
    },
    {
      name: "MIME and signature mismatch",
      type: "image/png",
      bytes: jpgBytes,
      status: 415,
    },
    {
      name: "oversized file",
      bytes: Buffer.alloc(5 * 1024 * 1024 + 1, 0),
      status: 413,
    },
  ])("rejects $name before upload", async ({ status, ...input }) => {
    const { response, upload } = await post(input);
    expect(response.status).toBe(status);
    expect(upload).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing actor without accessing storage", async () => {
    const { response, upload } = await post({
      mock: { voiceActorExists: false },
    });
    expect(response.status).toBe(404);
    expect(upload).not.toHaveBeenCalled();
  });

  it("returns a bounded error when storage rejects an upload", async () => {
    const { response } = await post({
      user: { id: "admin", app_metadata: { role: "admin" } },
      mock: { uploadSucceeds: false },
    });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("storage internals");
  });

  it("removes the staged object and preserves the old path if the database update fails", async () => {
    const { response, upload, remove } = await post({
      user: { id: "admin", app_metadata: { role: "admin" } },
      mock: { updateSucceeds: false },
    });

    expect(response.status).toBe(500);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
    expect(remove).not.toHaveBeenCalledWith(["41/old.png"]);
    expect(await response.text()).not.toContain("database internals");
  });

  it("does not return success or remove the old picture when the update affects no row", async () => {
    const { response, upload, remove } = await post({
      user: { id: "admin", app_metadata: { role: "admin" } },
      mock: { updateReturnsNoRows: true },
    });

    expect(response.status).toBe(500);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
    expect(remove).not.toHaveBeenCalledWith(["41/old.png"]);
    expect(await response.text()).not.toContain("database internals");
  });
});
