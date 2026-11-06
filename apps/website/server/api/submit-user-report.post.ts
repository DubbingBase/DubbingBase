import { isRecord } from "@app/shared-logic";
import { resolveUser } from "../utils/auth";
import { sendDiscordAdminNotification } from "../utils/notifications/discord";
import { useSupabaseAdmin } from "../utils/db/client";

const MAX_TARGET_URL_LENGTH = 2048;
const MAX_REASON_LENGTH = 100;
const MAX_DETAILS_LENGTH = 2000;

function isHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

function parseTargetUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw createError({ statusCode: 400, message: "Invalid target_url" });
  }
  if (value.length > MAX_TARGET_URL_LENGTH || !isHttpUrl(value)) {
    throw createError({ statusCode: 400, message: "Invalid target_url" });
  }
  return value;
}

function parseReason(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_REASON_LENGTH) {
    throw createError({ statusCode: 400, message: "Invalid reason" });
  }
  return value;
}

function parseDetails(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string" || value.length > MAX_DETAILS_LENGTH) {
    throw createError({ statusCode: 400, message: "Invalid details" });
  }
  return value;
}

export default defineEventHandler(async (event) => {
  const user = await resolveUser(event);
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  try {
    const body: unknown = await readBody(event);
    const target_url = isRecord(body) ? body.target_url : undefined;
    const reason = isRecord(body) ? body.reason : undefined;
    const details = isRecord(body) ? body.details : undefined;

    if (!target_url || !reason || (typeof reason === "string" && reason.trim() === "")) {
      throw createError({
        statusCode: 400,
        message: "Missing required fields (target_url, reason)",
      });
    }

    const validTargetUrl = parseTargetUrl(target_url);
    const validReason = parseReason(reason);
    const validDetails = parseDetails(details);

    const supabase = event.context.supabaseAdmin || useSupabaseAdmin();

    const { data, error } = await supabase
      .from("user_reports")
      .insert({
        reporter_id: user.id,
        target_url: validTargetUrl,
        reason: validReason,
        details: validDetails,
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
      `Reason: ${validReason}\nTarget: ${validTargetUrl}`,
      { url: "/admin/reports" },
    );

    return { success: true, data };
  } catch (err) {
    if (err && typeof err === "object" && "statusCode" in err) throw err;
    console.error("Exception in submit-user-report:", err);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
