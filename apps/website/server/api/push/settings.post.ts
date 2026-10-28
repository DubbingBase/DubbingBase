import { z } from "zod";
import { requireUser } from "../../utils/auth";
import { useSupabaseAdmin } from "../../utils/db/client";

const settingsSchema = z.object({ enabled: z.boolean() });

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const parsed = settingsSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: "Invalid push preference" });
  }

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data: updated, error: updateError } = await supabase
    .from("user_profiles")
    .update({ push_enabled: parsed.data.enabled })
    .eq("user_id", user.id)
    .select("user_id");
  if (updateError) {
    console.error("Push preference save failed", { code: updateError.code });
    throw createError({ statusCode: 500, message: "Push preference could not be saved" });
  }

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase.from("user_profiles").insert({
      user_id: user.id,
      push_enabled: parsed.data.enabled,
    });
    if (insertError) {
      console.error("Push preference create failed", { code: insertError.code });
      throw createError({ statusCode: 500, message: "Push preference could not be saved" });
    }
  }

  return { enabled: parsed.data.enabled };
});
