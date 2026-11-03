import { requireUser } from "../../utils/auth";
import { useSupabaseAdmin } from "../../utils/db/client";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data, error } = await supabase
    .from("user_profiles")
    .select("push_enabled")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Push preference lookup failed", { code: error.code });
    throw createError({ statusCode: 500, message: "Push preference could not be loaded" });
  }
  return { enabled: data?.push_enabled ?? false };
});
