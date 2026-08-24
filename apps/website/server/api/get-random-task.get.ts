import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  requireUser(event);

  try {
    const query = getQuery(event);
    let activeCategory = (query.category as string) || "any";

    if (activeCategory === "any") {
      const categories = ["enrich_voice_actor", "enrich_studio"];
      activeCategory =
        categories[Math.floor(Math.random() * categories.length)] ||
        "enrich_voice_actor";
    }

    const supabaseAdmin = useSupabaseAdmin();
    let candidates: any[] = [];

    if (activeCategory === "enrich_voice_actor") {
      const { data, error } = await supabaseAdmin
        .from("voice_actors")
        .select("*")
        .or(
          "profile_picture.is.null,nationality.is.null,date_of_birth.is.null,bio.is.null",
        )
        .limit(20);
      if (error) throw error;
      candidates = data || [];
    } else if (activeCategory === "enrich_studio") {
      const { data, error } = await supabaseAdmin
        .from("studios")
        .select("*")
        .or("logo_url.is.null,country.is.null,city.is.null,website_url.is.null")
        .limit(20);
      if (error) throw error;
      candidates = data || [];
    } else {
      throw createError({ statusCode: 400, message: "Invalid category" });
    }

    if (candidates.length === 0) {
      return {
        task: null,
        message: "No tasks available in this category!",
      };
    }

    candidates.sort(() => 0.5 - Math.random());

    let selectedTask = null;
    for (const candidate of candidates) {
      const idStr = candidate.id.toString();
      const { data: lockData } = await supabaseAdmin
        .from("gamification_task_locks")
        .select("*")
        .eq("category", activeCategory)
        .eq("entity_id", idStr)
        .maybeSingle();

      if (lockData && lockData.locked_at) {
        const lockedAt = new Date(lockData.locked_at).getTime();
        const now = Date.now();
        if (now - lockedAt < 5 * 60 * 1000) {
          continue;
        }
      }

      await supabaseAdmin.from("gamification_task_locks").upsert({
        category: activeCategory,
        entity_id: idStr,
        locked_at: new Date().toISOString(),
      });

      selectedTask = candidate;
      break;
    }

    if (!selectedTask) {
      return {
        task: null,
        message:
          "All tasks are currently locked by other users, try again in a few minutes!",
      };
    }

    return { task: selectedTask, category: activeCategory };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Unexpected error in get-random-task:", error);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
