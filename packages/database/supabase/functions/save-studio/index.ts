import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { purgeMediaForStudio } from "../_shared/cache-purge.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const { id, updates, isEditMode } = await req.json();

      if (!updates || !updates.name) {
        return Response.json(
          { error: "Missing studio name in updates parameter" },
          { status: 400 },
        );
      }

      // Check if user is authenticated (Optional based on rules, but good practice for mutations)
      // const user = ctx.userClaims;
      // if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

      if (isEditMode && id) {
        const { error } = await ctx.supabase
          .from("studios")
          .update(updates)
          .eq("id", Number(id));

        if (error) throw error;
        await purgeMediaForStudio(ctx.supabaseAdmin, Number(id));

        return Response.json({ success: true, message: "Studio updated" });
      } else {
        const { error } = await ctx.supabase.from("studios").insert([updates]);

        if (error) throw error;
        return Response.json({ success: true, message: "Studio created" });
      }
    } catch (error) {
      console.error("Error in save-studio function:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
        },
        { status: 500 },
      );
    }
  }),
};
