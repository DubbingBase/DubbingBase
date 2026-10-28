import { z } from "zod";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@app/shared-logic";
import { requireUser } from "../../utils/auth";
import { useSupabaseAdmin } from "../../utils/db/client";

const installationSchema = z.object({
  installation_id: z.string().uuid(),
  platform: z.enum(["android", "ios"]),
  token: z.string().min(1).max(4096),
  locale: z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE),
});

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const parsed = installationSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: "Invalid push installation" });
  }

  const userAgent = getHeader(event, "user-agent") ?? "";
  const eligibleUserAgent =
    parsed.data.platform === "android"
      ? /Android/i.test(userAgent)
      : /iPhone|iPad|iPod/i.test(userAgent) || /Macintosh.*Mobile/i.test(userAgent);
  if (!eligibleUserAgent) {
    throw createError({ statusCode: 400, message: "Push is only available on mobile devices" });
  }

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { error } = await supabase.from("push_installations").upsert(
    {
      user_id: user.id,
      installation_id: parsed.data.installation_id,
      fcm_token: parsed.data.token,
      locale: parsed.data.locale,
      platform: parsed.data.platform,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,installation_id" },
  );
  if (error) {
    if (error.code === "23505") {
      throw createError({ statusCode: 409, message: "Push token belongs to another installation" });
    }
    console.error("Push installation save failed", { code: error.code });
    throw createError({ statusCode: 500, message: "Push installation could not be saved" });
  }
  return { ok: true };
});
