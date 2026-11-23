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
  requireUser: vi.fn(),
  notifyContributionEdit: vi.fn(),
}));

vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));
vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../notifications/contribution", () => ({
  notifyContributionEdit: routeMocks.notifyContributionEdit,
}));

let handler: typeof import("../../api/upload-profile-picture.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readMultipartFormData", readMultipartFormData);
  handler = (await import("../../api/upload-profile-picture.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireUser.mockResolvedValue({ id: "user-1", app_metadata: { role: "user" } });
});
afterAll(() => vi.unstubAllGlobals());

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

type User = { id: string; app_metadata?: { role?: string; trusted?: boolean; blocked?: boolean } };
type MockOptions = {
  picture?: string | null;
  voiceActorExists?: boolean;
  uploadError?: boolean;
  rpcError?: { code: string };
  limiter?: { success: boolean };
};

function createSupabaseMock(options: MockOptions) {
  const upload = vi.fn(async (path: string) =>
    options.uploadError
      ? { data: null, error: new Error("storage internals") }
      : { data: { path }, error: null },
  );
  const remove = vi.fn(async (_paths: string[]) => ({ data: null, error: null }));
  const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) =>
    options.rpcError
      ? { data: null, error: options.rpcError }
      : {
          data: [{ previous_picture: options.picture ?? null, audit_log_id: "audit-1" }],
          error: null,
        },
  );
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data:
        options.voiceActorExists === false
          ? null
          : { id: 41, profile_picture: options.picture ?? null },
      error: null,
    })),
  };
  const supabase = {
    from: vi.fn(() => query),
    rpc,
    storage: { from: vi.fn(() => ({ upload, remove })) },
  };
  return { supabase, upload, remove, rpc };
}

async function post(
  options: {
    user?: User | "anonymous";
    bytes?: Buffer;
    type?: string;
    cloudflare?: boolean;
    mock?: MockOptions;
  } = {},
) {
  const mocks = createSupabaseMock(options.mock ?? {});
  routeMocks.useSupabaseAdmin.mockReturnValue(mocks.supabase);
  if (options.user === "anonymous") {
    routeMocks.requireUser.mockRejectedValue(
      createError({ statusCode: 401, message: "Unauthorized" }),
    );
  } else if (options.user) {
    routeMocks.requireUser.mockResolvedValue(options.user);
  }
  const limiter = vi.fn(async () => options.mock?.limiter ?? { success: true });
  const form = new FormData();
  form.append(
    "file",
    new Blob([options.bytes ?? pngBytes], { type: options.type ?? "image/png" }),
    "profile.png",
  );
  form.append("voice_actor_id", "41");
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      if (options.cloudflare)
        event.context.cloudflare = { env: { PROFILE_PICTURE_UPLOAD_LIMITER: { limit: limiter } } };
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
  it("requires a signed-in account", async () => {
    const { response, upload } = await post({ user: "anonymous" });
    expect(response.status).toBe(401);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects accounts already blocked in their token before touching storage", async () => {
    const { response, upload } = await post({
      user: { id: "user-1", app_metadata: { blocked: true } },
    });
    expect(response.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });

  it("lets a regular user add a first picture through the atomic database swap", async () => {
    const { response, upload, rpc } = await post({ mock: { picture: null } });
    expect(response.status).toBe(200);
    expect(upload).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      "controlled_set_voice_actor_picture",
      expect.objectContaining({ p_actor_id: "user-1", p_voice_actor_id: 41 }),
    );
    expect(routeMocks.notifyContributionEdit).toHaveBeenCalledOnce();
  });

  it("denies a regular user replacing an existing picture before any upload", async () => {
    const { response, upload, rpc } = await post({ mock: { picture: "41/old.png" } });
    expect(response.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets a trusted account replace a picture and keeps the old file for restoration", async () => {
    const { response, remove, rpc } = await post({
      user: { id: "trusted-1", app_metadata: { trusted: true } },
      mock: { picture: "41/11111111-1111-4111-8111-111111111111.png" },
    });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "controlled_set_voice_actor_picture",
      expect.objectContaining({
        p_expected_previous: "41/11111111-1111-4111-8111-111111111111.png",
      }),
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it("lets an admin replace a picture and removes the attributable old file", async () => {
    const { response, remove } = await post({
      user: { id: "admin-1", app_metadata: { role: "admin" } },
      mock: { picture: "41/11111111-1111-4111-8111-111111111111.png" },
    });
    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalledWith(["41/11111111-1111-4111-8111-111111111111.png"]);
  });

  it.each([
    ["42501", 403],
    ["40001", 409],
    ["PT409", 409],
    ["P0002", 404],
    ["XX000", 500],
  ])("maps database error %s to %i and removes the staged upload", async (code, status) => {
    const { response, upload, remove } = await post({ mock: { rpcError: { code } } });
    expect(response.status).toBe(status);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]?.[0]]);
    expect(routeMocks.notifyContributionEdit).not.toHaveBeenCalled();
  });

  it("rejects unsupported or forged images without uploading", async () => {
    const forged = await post({ bytes: Buffer.from("not an image"), type: "image/png" });
    expect(forged.response.status).toBe(415);
    expect(forged.upload).not.toHaveBeenCalled();
    const svg = await post({ bytes: Buffer.from("<svg/>"), type: "image/svg+xml" });
    expect(svg.response.status).toBe(415);
  });

  it("returns 404 for an unknown voice actor without uploading", async () => {
    const { response, upload } = await post({ mock: { voiceActorExists: false } });
    expect(response.status).toBe(404);
    expect(upload).not.toHaveBeenCalled();
  });

  it("limits uploads per IP address and per account", async () => {
    const denied = await post({ cloudflare: true, mock: { limiter: { success: false } } });
    expect(denied.response.status).toBe(429);
    expect(denied.upload).not.toHaveBeenCalled();

    const allowed = await post({ cloudflare: true });
    expect(allowed.response.status).toBe(200);
    expect(allowed.limiter).toHaveBeenCalledWith({ key: "voice-actor-picture-upload:192.0.2.1" });
    expect(allowed.limiter).toHaveBeenCalledWith({ key: "voice-actor-picture-upload-user:user-1" });
  });
});
