import { defineEventHandler, type H3Event } from "h3";
import type { User } from "@supabase/supabase-js";
import { requireAdmin, requireUser } from "./auth";

/**
 * Declares that a route needs a signed-in user. The user is resolved just
 * before the handler runs (401 if anonymous), so routes that do not use these
 * wrappers never pay for authentication.
 */
export function defineUserHandler<T>(handler: (event: H3Event, user: User) => T | Promise<T>) {
  return defineEventHandler(async (event) => handler(event, await requireUser(event)));
}

/** Like `defineUserHandler`, but also requires the `admin` role (403 otherwise). */
export function defineAdminHandler<T>(handler: (event: H3Event, admin: User) => T | Promise<T>) {
  return defineEventHandler(async (event) => handler(event, await requireAdmin(event)));
}
