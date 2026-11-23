import { defineAdminHandler } from "../../utils/auth-handlers";
import { useSupabaseAdmin } from "../../utils/db/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Revokes one of the signed-in admin's tokens. Revoked rows are kept for the audit trail. */
export default defineAdminHandler(async (event, admin) => {
  const id = getRouterParam(event, "id");
  if (!id || !UUID.test(id)) {
    throw createError({ statusCode: 400, message: "Invalid token id" });
  }
  const { data, error } = await useSupabaseAdmin(event)
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", admin.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    throw createError({ statusCode: 500, message: "Failed to revoke API token" });
  }
  if (!data) {
    throw createError({ statusCode: 404, message: "API token not found" });
  }
  setHeader(event, "Cache-Control", "no-store");
  return { revoked: true };
});
