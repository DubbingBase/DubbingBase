import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { purgeMediaForWork } from "../_shared/cache-purge.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
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
      const { id } = body;
      if (!id) {
        return Response.json({ error: "Missing id" }, { status: 400 });
      }

      const { error } = await ctx.supabaseAdmin
        .from("work")
        .delete()
        .eq("id", id);
      if (error) {
        return Response.json({ error }, { status: 500 });
      }

      await purgeMediaForWork(ctx.supabaseAdmin, id);

      return Response.json({ success: true });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Invalid Request" },
        { status: 400 },
      );
    }
  }),
};
