import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

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
      // Call the RPC to merge safely and bypass any pagination limits
      const { error: rpcError } = await ctx.supabaseAdmin.rpc(
        "merge_voice_actors",
        {
          p_keep_id: keepId,
          p_other_ids: otherIds,
        },
      );

      if (rpcError) {
        return Response.json({ error: rpcError }, { status: 500 });
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
