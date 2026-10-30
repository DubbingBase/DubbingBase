import { requireAdmin } from "../../utils/auth";
import { useSupabaseAdmin } from "../../utils/db/client";
import { requireDubbingLanguage } from "../../utils/dubbing-language";

const MEDIA_TYPES = ["movie", "tv", "video_game", "audiobook", "podcast", "advertisement", "toy"];

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const query = getQuery(event);
  const compactVoiceActors = query.compact_voice_actors === "true";
  const contentId = Number(query.content_id);
  const contentType = query.content_type;
  const dubbingLanguage = requireDubbingLanguage(query.dubbing_language);

  if (
    !Number.isSafeInteger(contentId) ||
    contentId <= 0 ||
    typeof contentType !== "string" ||
    !MEDIA_TYPES.includes(contentType)
  ) {
    throw createError({ statusCode: 400, message: "Invalid media selection" });
  }

  const supabase = useSupabaseAdmin(event);
  const { data: project, error: projectError } = await supabase
    .from("dubbing_projects")
    .select("id")
    .eq("content_id", contentId)
    .eq("content_type", contentType)
    .eq("language", dubbingLanguage)
    .maybeSingle();

  if (projectError) throw projectError;
  if (!project) return { projectId: null, works: [] };

  const { data: works, error: worksError } = await supabase
    .from("work")
    .select(
      "id, actor_id, voice_actor_id, voice_actor:voice_actors(id, firstname, lastname, profile_picture)",
    )
    .eq("dubbing_project_id", project.id);

  if (worksError) throw worksError;
  const workRows = works ?? [];
  const workCountByActor = new Map<number, number>();
  for (const work of workRows) {
    if (work.actor_id === null) continue;
    workCountByActor.set(work.actor_id, (workCountByActor.get(work.actor_id) ?? 0) + 1);
  }

  const includedVoiceActorIds = new Set<number>();
  return {
    projectId: project.id,
    works: workRows.map((work) => {
      const voiceActorIsNew =
        work.voice_actor !== null && !includedVoiceActorIds.has(work.voice_actor.id);
      if (voiceActorIsNew && work.voice_actor) {
        includedVoiceActorIds.add(work.voice_actor.id);
      }

      return {
        work_id: work.id,
        actor_id: work.actor_id,
        voice_actor_id: work.voice_actor_id,
        voice_actor: compactVoiceActors && !voiceActorIsNew ? null : work.voice_actor,
        editable: work.actor_id !== null && workCountByActor.get(work.actor_id) === 1,
      };
    }),
  };
});
