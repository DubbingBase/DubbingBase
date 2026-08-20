import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const supabaseAdmin = useSupabaseAdmin();

  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  const registeredUsers = data.users.filter(
    (u: any) => !u.is_anonymous && u.email,
  );

  return { users: registeredUsers };
});
