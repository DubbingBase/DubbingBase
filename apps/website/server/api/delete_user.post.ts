import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const body = await readBody(event);
  const { userId } = body;
  if (!userId) {
    throw createError({ statusCode: 400, message: "Missing userId" });
  }

  const supabaseAdmin = useSupabaseAdmin();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  return { success: true };
});
