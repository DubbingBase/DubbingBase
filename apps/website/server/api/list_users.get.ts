import { defineAdminHandler } from "../utils/auth-handlers";
import { useSupabaseAdmin } from "../utils/db/client";
import { readProperty } from "@app/shared-logic";
export default defineAdminHandler(async (event) => {
  const supabaseAdmin = useSupabaseAdmin();

  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    throw createError({ statusCode: 500, message: error.message });
  }

  const registeredUsers = data.users.filter((user) => !user.is_anonymous && user.email);

  if (getQuery(event).projection === "admin-list") {
    return {
      users: registeredUsers.map((user) => ({
        id: user.id,
        email: user.email ?? "",
        created_at: user.created_at,
        app_metadata: { role: readProperty(user.app_metadata, "role") },
      })),
    };
  }

  return { users: registeredUsers };
});
