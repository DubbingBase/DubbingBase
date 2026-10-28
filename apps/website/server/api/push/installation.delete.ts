import { z } from "zod";
import { requireUser } from "../../utils/auth";
import { useSupabaseAdmin } from "../../utils/db/client";

const installationSchema = z.object({ installation_id: z.string().uuid() });

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const parsed = installationSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: "Invalid push installation" });
  }

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { error } = await supabase
    .from("push_installations")
    .delete()
    .eq("user_id", user.id)
    .eq("installation_id", parsed.data.installation_id);
  if (error) {
    console.error("Push installation detach failed", { code: error.code });
    throw createError({ statusCode: 500, message: "Push installation could not be removed" });
  }
  return { ok: true };
});
