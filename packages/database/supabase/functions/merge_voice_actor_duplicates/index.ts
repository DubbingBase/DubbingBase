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
      console.log("body", body);
      const { keepId, ids } = body;
      if (!keepId || !ids || !Array.isArray(ids) || ids.length === 0) {
        return Response.json({ error: "Invalid input" }, { status: 400 });
      }

      // Remove keepId from ids if present
      const otherIds = ids.filter((id: number) => id !== keepId);
      console.log("otherIds", otherIds);
      if (otherIds.length === 0) {
        return Response.json({
          success: true,
          message: "No duplicates to merge.",
        });
      }

      // 1. Update all 'work' records to point to keepId
      const { error: updateError } = await ctx.supabaseAdmin
        .from("work")
        .update({ voice_actor_id: keepId })
        .in("voice_actor_id", otherIds);
      if (updateError) {
        return Response.json({ error: updateError }, { status: 500 });
      }

      // 2. Delete the duplicate voice_actors
      const { error: deleteError } = await ctx.supabaseAdmin
        .from("voice_actors")
        .delete()
        .in("id", otherIds);
      if (deleteError) {
        return Response.json({ error: deleteError }, { status: 500 });
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
