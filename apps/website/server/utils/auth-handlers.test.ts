import { createEvent, type H3Event } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { defineAdminHandler, defineUserHandler } from "./auth-handlers";

function makeEvent(user?: Partial<User>): H3Event {
  const request = new IncomingMessage(new Socket());
  request.method = "GET";
  request.url = "/api/test";
  const event = createEvent(request, new ServerResponse(request));
  if (user) event.context.user = user;
  return event;
}

describe("auth handler wrappers", () => {
  it("passes the signed-in user to the handler", async () => {
    const handler = vi.fn((_event: H3Event, user: User) => ({ id: user.id }));
    const route = defineUserHandler(handler);

    await expect(route(makeEvent({ id: "u1", app_metadata: {} }))).resolves.toEqual({ id: "u1" });
  });

  it("rejects anonymous requests before running the handler", async () => {
    const handler = vi.fn();

    await expect(defineUserHandler(handler)(makeEvent())).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("requires the admin role for admin routes", async () => {
    const handler = vi.fn(() => "ok");
    const route = defineAdminHandler(handler);

    await expect(route(makeEvent({ id: "u1", app_metadata: {} }))).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(handler).not.toHaveBeenCalled();
    await expect(route(makeEvent({ id: "a1", app_metadata: { role: "admin" } }))).resolves.toBe(
      "ok",
    );
  });
});
