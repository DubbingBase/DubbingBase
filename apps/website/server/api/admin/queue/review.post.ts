import { requireAdmin } from "../../../utils/auth";
import { useSupabaseAdmin } from "../../../utils/db/client";
import { requireDubbingLanguage } from "../../../utils/dubbing-language";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const body: unknown = await readBody(event);
  if (!isRecord(body)) {
    throw createError({ statusCode: 400, message: "Invalid request body" });
  }

  const messageId = body.id;
  if (
    typeof messageId !== "number" ||
    !Number.isSafeInteger(messageId) ||
    messageId <= 0
  ) {
    throw createError({ statusCode: 400, message: "Invalid queue item id" });
  }
  const dubbingLanguage = requireDubbingLanguage(body.dubbing_language);
  const supabase = useSupabaseAdmin(event);
  const { data: resumed, error } = await supabase.rpc(
    "resume_wiki_check_for_regional_review",
    {
      p_msg_id: messageId,
      p_dubbing_language: dubbingLanguage,
    },
  );

  if (error) throw error;
  if (!resumed) {
    throw createError({
      statusCode: 409,
      message: "This item is no longer waiting for regional review",
    });
  }

  return { resumed: true };
});
