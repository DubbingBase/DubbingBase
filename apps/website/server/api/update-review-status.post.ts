import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  try {
    const body = await readBody(event);
    const { work_id, reviewed_status } = body;

    if (!work_id || !reviewed_status) {
      throw createError({
        statusCode: 400,
        message: "work_id and reviewed_status are required",
      });
    }

    const validStatuses = ["waiting", "accepted", "rejected"];
    if (!validStatuses.includes(reviewed_status)) {
      throw createError({
        statusCode: 400,
        message: "Invalid reviewed_status value",
      });
    }

    const isAdmin =
      user.app_metadata?.role === "admin" ||
      user.user_metadata?.role === "admin" ||
      (user as any).role === "admin";

    let canUpdate = isAdmin;

    const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

    if (!canUpdate) {
      const { data: workData, error: workError } = await supabaseAdmin
        .from("work")
        .select("voice_actor_id")
        .eq("id", work_id)
        .single();

      if (workError) {
        throw createError({ statusCode: 404, message: "Work not found" });
      }

      const { data: userVoiceActor } = await supabaseAdmin
        .from("user_voice_actor_links")
        .select("voice_actor_id")
        .eq("user_id", user.id)
        .eq("voice_actor_id", workData.voice_actor_id!)
        .single();

      canUpdate = !!userVoiceActor;
    }

    if (!canUpdate) {
      throw createError({
        statusCode: 403,
        message: "Insufficient permissions",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("work")
      .update({ reviewed_status })
      .eq("id", work_id)
      .select("*, dubbing_projects(*)")
      .single();

    if (error) {
      console.error("Error updating review status:", error);
      throw createError({
        statusCode: 500,
        message: "Failed to update review status",
      });
    }

    try {
      const cache = useCache();
      const contentId = data.dubbing_projects?.content_id;
      const contentType = data.dubbing_projects?.content_type || "movie";

      if (contentId) {
        const cacheKey =
          contentType === "movie"
            ? CACHE_KEYS.TMDB_MOVIE(contentId)
            : CACHE_KEYS.TMDB_TV(contentId);
        await cache.del(cacheKey);

        if (contentType === "tv") {
          const aggregateCacheKey = CACHE_KEYS.TMDB_TV(
            contentId,
            "aggregate_credits",
          );
          await cache.del(aggregateCacheKey);
        }
      }
    } catch (cacheError) {
      console.error("Failed to invalidate cache:", cacheError);
    }

    return { success: true, data };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Error in update-review-status:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
