import type { User } from "@supabase/supabase-js";

export function requireUser(event: any): User {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }
  return user;
}

export function requireAdmin(event: any): User {
  const user = requireUser(event);
  const isAdmin =
    user.app_metadata?.role === "admin" ||
    user.user_metadata?.role === "admin" ||
    (user as any).role === "admin";

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      message: "Unauthorized: Admin access required",
    });
  }
  return user;
}
