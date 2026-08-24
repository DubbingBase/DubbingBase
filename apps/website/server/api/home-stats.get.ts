import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async () => {
  try {
    const supabase = useSupabaseAdmin();

    const [vaResult, dpResult, workResult] = await Promise.all([
      supabase.from("voice_actors").select("*", { count: "exact", head: true }),
      supabase
        .from("dubbing_projects")
        .select("*", { count: "exact", head: true }),
      supabase.from("work").select("*", { count: "exact", head: true }),
    ]);

    return {
      voiceActorCount: vaResult.count || 0,
      dubbingProjectCount: dpResult.count || 0,
      workCount: workResult.count || 0,
    };
  } catch (error) {
    console.error("Error in home-stats:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
