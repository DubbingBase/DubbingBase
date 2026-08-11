import { withSupabase } from "npm:@supabase/server@^1";
import { sendDiscordAdminNotification } from "../_shared/discord.ts";
import type { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const { target_url, reason, details } = await req.json();

      if (!target_url || !reason) {
        return Response.json(
          { error: "Missing required fields (target_url, reason)" },
          { status: 400 },
        );
      }

      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const reporter_id = user.id;

      // Insert into user_reports table
      const { data, error } = await ctx.supabase
        .from("user_reports")
        .insert({
          reporter_id,
          target_url,
          reason,
          details,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        console.error("Error inserting report:", error);
        return Response.json(
          { error: "Failed to submit report" },
          { status: 500 },
        );
      }

      await sendDiscordAdminNotification(
        "New User Report",
        `Reason: ${reason}\nTarget: ${target_url}`,
        {
          url: "/admin/reports",
        },
      );

      return Response.json({ success: true, data });
    } catch (err: any) {
      console.error("Exception in submit-user-report:", err);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
