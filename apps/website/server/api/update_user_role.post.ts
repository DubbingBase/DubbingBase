import { isRecord } from "@app/shared-logic";
import { defineAdminHandler } from "../utils/auth-handlers";
import { useSupabaseAdmin } from "../utils/db/client";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Roles the admin users page can assign; `admin` gates admin-only routes.
function isAssignableRole(value: unknown): value is "user" | "admin" {
  return value === "user" || value === "admin";
}

// Admins manage a user's role and the two contributor flags here. `blocked` stops all
// contributions (checked inside the write RPCs); `trusted` makes edits auto-verified.
// Supabase merges app_metadata keys, so only the supplied keys change.
export default defineAdminHandler(async (event) => {
  const body: unknown = await readBody(event);
  const input = isRecord(body) ? body : {};
  const { userId, role, blocked, trusted } = input;
  if (!userId || (role === undefined && blocked === undefined && trusted === undefined)) {
    throw createError({
      statusCode: 400,
      message: "Missing userId or a role/blocked/trusted change",
    });
  }
  if (typeof userId !== "string" || !uuidPattern.test(userId)) {
    throw createError({ statusCode: 400, message: "Invalid userId" });
  }
  if (role !== undefined && !isAssignableRole(role)) {
    throw createError({ statusCode: 400, message: "Invalid role" });
  }
  if (blocked !== undefined && typeof blocked !== "boolean") {
    throw createError({ statusCode: 400, message: "Invalid blocked flag" });
  }
  if (trusted !== undefined && typeof trusted !== "boolean") {
    throw createError({ statusCode: 400, message: "Invalid trusted flag" });
  }

  const supabaseAdmin = useSupabaseAdmin();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...(role === undefined ? {} : { role }),
      ...(blocked === undefined ? {} : { blocked }),
      ...(trusted === undefined ? {} : { trusted }),
    },
  });
  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  return { success: true };
});
