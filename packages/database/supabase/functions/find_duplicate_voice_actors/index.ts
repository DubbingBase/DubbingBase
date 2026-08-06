import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      console.log("ctx.userClaims", ctx.userClaims);
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

      const { data, error } = await ctx.supabase.rpc(
        "find_duplicate_voice_actors_rpc",
      );

      if (error) {
        throw error;
      }

      const formattedData =
        (data as any[])?.map((group: any) => ({
          ...group,
          actors: group.actors.map((actor: any) => ({
            ...actor,
            profile_picture: buildSupabaseImageUrl(ctx, actor.profile_picture),
          })),
        })) || [];

      return Response.json(formattedData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error finding duplicate voice actors:", errorMessage);

      return Response.json(
        {
          error: "Failed to process request",
          details: errorMessage,
        },
        { status: 500 },
      );
    }
  }),
};
