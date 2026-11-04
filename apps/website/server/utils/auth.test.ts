import { createEvent, type H3Event } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { requireAdmin, requireUser, resolveUser } from "./auth";

function makeEvent(headers: Record<string, string> = {}): H3Event {
  const request = new IncomingMessage(new Socket());
  request.method = "GET";
  request.url = "/api/test";
  Object.assign(request.headers, headers);
  return createEvent(request, new ServerResponse(request));
}

function makeUser(role?: string): User {
  return {
    id: "user-1",
    app_metadata: role ? { role } : {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("lazy auth helpers", () => {
  it("treats a request without token or auth cookie as anonymous without any lookup", async () => {
    const event = makeEvent({ cookie: "user_lang=fr; theme=dark" });

    await expect(resolveUser(event)).resolves.toBeNull();
    expect(event.context.user).toBeUndefined();
  });

  it("returns a user already resolved on the event", async () => {
    const event = makeEvent();
    const user = makeUser();
    event.context.user = user;

    await expect(resolveUser(event)).resolves.toBe(user);
  });

  it("rejects anonymous requests with 401", async () => {
    await expect(requireUser(makeEvent())).rejects.toMatchObject({ statusCode: 401 });
  });

  it("requires the admin role", async () => {
    const regular = makeEvent();
    regular.context.user = makeUser();
    await expect(requireAdmin(regular)).rejects.toMatchObject({ statusCode: 403 });

    const admin = makeEvent();
    admin.context.user = makeUser("admin");
    await expect(requireAdmin(admin)).resolves.toMatchObject({ id: "user-1" });
  });
});
