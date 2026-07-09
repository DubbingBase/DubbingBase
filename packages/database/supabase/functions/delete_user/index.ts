import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json(
          { error: "Unauthorized" },
          { status: 401 },
        );
      }

      const isAdmin =
        user.appMetadata?.role === "admin" ||
        user.userMetadata?.role === "admin" ||
        user.role === "admin";

      if (!isAdmin) {
        return Response.json(
          { error: "Unauthorized: Admin access required" },
          { status: 403 },
        );
      }

      const body = await req.json();
      const { userId } = body;
      if (!userId) {
        return Response.json({ error: "Missing userId" }, { status: 400 });
      }

      const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        return Response.json({ error }, { status: 500 });
      }
      return Response.json({ success: true });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }),
};
