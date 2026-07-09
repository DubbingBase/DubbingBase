import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (_req, ctx) => {
    const user = ctx.userClaims;
    const isAdmin = user?.appMetadata?.role === "admin" ||
      user?.userMetadata?.role === "admin" ||
      user?.role === "admin";

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
  }),
};
