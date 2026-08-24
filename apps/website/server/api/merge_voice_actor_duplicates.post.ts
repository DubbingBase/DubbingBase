import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const body = await readBody(event);
  const { keepId, ids } = body;
  if (!keepId || !ids || !Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, message: "Invalid input" });
  }

  const otherIds = ids.filter((id: number) => id !== keepId);
  if (otherIds.length === 0) {
    return {
      success: true,
      message: "No duplicates to merge.",
    };
  }

  const supabaseAdmin = useSupabaseAdmin();
  const { error: rpcError } = await supabaseAdmin.rpc("merge_voice_actors", {
    p_keep_id: keepId,
    p_other_ids: otherIds,
  });

  if (rpcError) {
    throw createError({ statusCode: 500, message: rpcError.message });
  }

  return { success: true };
});
