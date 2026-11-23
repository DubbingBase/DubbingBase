import { defineAdminHandler } from "../../utils/auth-handlers";
import { useSupabaseAdmin } from "../../utils/db/client";

/** Lists the signed-in admin's tokens. Hashes are never selected, only the display prefix. */
export default defineAdminHandler(async (event, admin) => {
  const { data, error } = await useSupabaseAdmin(event)
    .from("api_tokens")
    .select("id, name, prefix, scopes, expires_at, last_used_at, revoked_at, created_at")
    .eq("user_id", admin.id)
    .order("created_at", { ascending: false });
  if (error) {
    throw createError({ statusCode: 500, message: "Failed to list API tokens" });
  }
  setHeader(event, "Cache-Control", "no-store");
  return { tokens: data };
});
