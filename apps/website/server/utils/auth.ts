import type { User } from "@supabase/supabase-js";
import type { H3Event } from "h3";

export function requireUser(event: H3Event): User {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }
  return user;
}

export function requireAdmin(event: H3Event): User {
  const user = requireUser(event);
  const isAdmin = user.app_metadata?.role === "admin";

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      message: "Unauthorized: Admin access required",
    });
  }
  return user;
}
