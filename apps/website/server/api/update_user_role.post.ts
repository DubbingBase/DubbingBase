import { isRecord } from "@app/shared-logic";
import { defineAdminHandler } from "../utils/auth-handlers";
import { useSupabaseAdmin } from "../utils/db/client";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Roles the admin users page can assign; `admin` gates admin-only routes.
function isAssignableRole(value: unknown): value is "user" | "admin" {
  return value === "user" || value === "admin";
}

export default defineAdminHandler(async (event) => {
  const body: unknown = await readBody(event);
  const userId: unknown = isRecord(body) ? body.userId : undefined;
  const role: unknown = isRecord(body) ? body.role : undefined;
  if (!userId || !role) {
    throw createError({
      statusCode: 400,
      message: "Missing userId or role",
    });
  }
  if (typeof userId !== "string" || !uuidPattern.test(userId)) {
    throw createError({ statusCode: 400, message: "Invalid userId" });
  }
  if (!isAssignableRole(role)) {
    throw createError({ statusCode: 400, message: "Invalid role" });
  }

  const supabaseAdmin = useSupabaseAdmin();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  return { success: true };
});
