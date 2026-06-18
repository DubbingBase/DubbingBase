import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "secret:*" }, async (req, ctx) => {
    try {
      const body = await req.json();
      const { userId, role } = body;
      if (!userId || !role) {
        return Response.json(
          { error: "Missing userId or role" },
          { status: 400 },
        );
      }

      const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          app_metadata: { role },
        },
      );
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
