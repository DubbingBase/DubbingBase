import { sendDiscordAdminNotification } from "../utils/notifications/discord";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  try {
    const body = await readBody(event);
    const { target_url, reason, details } = body;

    if (!target_url || !reason) {
      throw createError({
        statusCode: 400,
        message: "Missing required fields (target_url, reason)",
      });
    }

    const supabase = event.context.supabaseAdmin || useSupabaseAdmin();

    const { data, error } = await supabase
      .from("user_reports")
      .insert({
        reporter_id: user.id,
        target_url,
        reason,
        details,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting report:", error);
      throw createError({
        statusCode: 500,
        message: "Failed to submit report",
      });
    }

    await sendDiscordAdminNotification(
      "New User Report",
      `Reason: ${reason}\nTarget: ${target_url}`,
      { url: "/admin/reports" },
    );

    return { success: true, data };
  } catch (err: any) {
    if (err && typeof err === "object" && "statusCode" in err) throw err;
    console.error("Exception in submit-user-report:", err);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
