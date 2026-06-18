import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "secret:*" }, async (req, ctx) => {
    try {
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

      return Response.json({ success: true });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Invalid Request" },
        { status: 400 },
      );
    }
  }),
};
