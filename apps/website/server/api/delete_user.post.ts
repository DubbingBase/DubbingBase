import { isRecord } from "@app/shared-logic";
import { defineAdminHandler } from "../utils/auth-handlers";
import { useSupabaseAdmin } from "../utils/db/client";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineAdminHandler(async (event) => {
  const body: unknown = await readBody(event);
  const userId: unknown = isRecord(body) ? body.userId : undefined;
  if (!userId) {
    throw createError({ statusCode: 400, message: "Missing userId" });
  }
  if (typeof userId !== "string" || !uuidPattern.test(userId)) {
    throw createError({ statusCode: 400, message: "Invalid userId" });
  }

  const supabaseAdmin = useSupabaseAdmin();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  return { success: true };
});
