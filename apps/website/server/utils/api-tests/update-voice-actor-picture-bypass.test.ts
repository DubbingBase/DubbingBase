import {
  createApp,
  createError,
  defineEventHandler,
  readMultipartFormData,
  readBody,
  toWebHandler,
} from "h3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let submitTask: typeof import("../../api/submit-task.post").default;
let revertTask: typeof import("../../api/revert-task.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readMultipartFormData", readMultipartFormData);
  vi.stubGlobal("readBody", readBody);
  submitTask = (await import("../../api/submit-task.post")).default;
  revertTask = (await import("../../api/revert-task.post")).default;
});

afterAll(() => vi.unstubAllGlobals());

describe("voice actor profile-picture mutation paths", () => {
  it("rejects legacy unclaimed picture submissions before privileged storage writes", async () => {
    const upload = vi.fn();
    const supabaseAdmin = { storage: { from: vi.fn(() => ({ upload })) } };
    const form = new FormData();
    form.append("category", "enrich_voice_actor");
    form.append("entityId", "41");
    form.append("file", new Blob(["image"]), "picture.png");
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => {
        event.context.user = { id: "linked-user" };
        event.context.supabaseAdmin = supabaseAdmin;
        return submitTask(event);
      }),
    );

    const response = await toWebHandler(app)(
      new Request("http://localhost/", { method: "POST", body: form }),
    );
    expect(response.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("blocks non-admin voice-actor audit reverts before picture database writes", async () => {
    const actorUpdate = vi.fn();
    const auditQuery = {
      select: vi.fn(() => auditQuery),
      eq: vi.fn(() => auditQuery),
      single: vi.fn(async () => ({
        data: {
          entity_type: "voice_actor",
          entity_id: "41",
          new_value: { profile_picture: "41/new.jpg" },
          previous_value: null,
          reverted_at: null,
        },
        error: null,
      })),
    };
    const supabaseAdmin = {
      from: vi.fn((table: string) =>
        table === "audit_logs" ? auditQuery : { update: actorUpdate },
      ),
    };
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => {
        event.context.user = { id: "linked-user" };
        event.context.supabaseAdmin = supabaseAdmin;
        return revertTask(event);
      }),
    );

    const response = await toWebHandler(app)(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          auditLogId: "audit-1",
          force: true,
          resolvedValue: null,
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(actorUpdate).not.toHaveBeenCalled();
  });

  it("rejects audit reverts for entity types without a supported rollback", async () => {
    const auditQuery = {
      select: vi.fn(() => auditQuery),
      eq: vi.fn(() => auditQuery),
      single: vi.fn(async () => ({
        data: {
          entity_type: "studio",
          entity_id: "41",
          new_value: { name: "Studio" },
          previous_value: { name: "Old studio" },
          reverted_at: null,
        },
        error: null,
      })),
    };
    const from = vi.fn(() => auditQuery);
    const supabaseAdmin = { from };
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => {
        event.context.user = { id: "admin", app_metadata: { role: "admin" } };
        event.context.supabaseAdmin = supabaseAdmin;
        return revertTask(event);
      }),
    );

    const response = await toWebHandler(app)(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ auditLogId: "audit-studio", force: true }),
      }),
    );
    expect(response.status).toBe(400);
    expect(from).toHaveBeenCalledOnce();
  });

  it("rejects creation audit reverts before changing the entity or audit history", async () => {
    const auditQuery = {
      select: vi.fn(() => auditQuery),
      eq: vi.fn(() => auditQuery),
      single: vi.fn(async () => ({
        data: {
          entity_type: "voice_actor",
          entity_id: "41",
          action: "create",
          new_value: { firstname: "Created", lastname: "Actor" },
          previous_value: null,
          reverted_at: null,
        },
        error: null,
      })),
    };
    const from = vi.fn(() => auditQuery);
    const supabaseAdmin = { from };
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => {
        event.context.user = {
          id: "linked-user",
          app_metadata: { role: "admin" },
        };
        event.context.supabaseAdmin = supabaseAdmin;
        return revertTask(event);
      }),
    );

    const response = await toWebHandler(app)(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ auditLogId: "audit-create", force: true }),
      }),
    );

    expect(response.status).toBe(409);
    expect(from).toHaveBeenCalledOnce();
  });
});
