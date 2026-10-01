import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const body = await readBody(event);
  const { userId, role } = body;
  if (!userId || !role) {
    throw createError({
      statusCode: 400,
      message: "Missing userId or role",
    });
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
