import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json(
          { error: "Unauthorized: Invalid session" },
          { status: 401 },
        );
      }

      const isAdmin = user.appMetadata?.role === "admin" ||
        user.userMetadata?.role === "admin" ||
        user.role === "admin";

      if (!isAdmin) {
        return Response.json(
          { error: "Unauthorized: Admin access required" },
          { status: 403 },
        );
      }

      const { data, error } = await ctx.supabaseAdmin.auth.admin.listUsers();
      if (error) {
        return Response.json({ error }, { status: 500 });
      }
      return Response.json({ users: data.users });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }),
};
