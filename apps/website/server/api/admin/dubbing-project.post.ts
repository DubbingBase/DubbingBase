import { requireAdmin } from "../../utils/auth";
import { useSupabaseAdmin } from "../../utils/db/client";
import { findOrCreateDubbingProject } from "../../utils/db/dubbing-project";
import { requireDubbingLanguage } from "../../utils/dubbing-language";

const MEDIA_TYPES = [
  "movie",
  "tv",
  "video_game",
  "audiobook",
  "podcast",
  "advertisement",
  "toy",
];

interface Assignment {
  actor_id: number;
  voice_actor_id: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const body: unknown = await readBody(event);
  if (!isRecord(body)) {
    throw createError({ statusCode: 400, message: "Invalid request body" });
  }

  const contentId = body.content_id;
  const contentType = body.content_type;
  const dubbingLanguage = requireDubbingLanguage(body.dubbing_language);
  const actorIdsInput = body.actor_ids;
  const assignmentsInput = body.assignments;

  if (
    !isPositiveId(contentId) ||
    typeof contentType !== "string" ||
    !MEDIA_TYPES.includes(contentType) ||
    !Array.isArray(actorIdsInput) ||
    !actorIdsInput.every(isPositiveId) ||
    !Array.isArray(assignmentsInput)
  ) {
    throw createError({
      statusCode: 400,
      message: "Invalid regional assignments",
    });
  }

  const actorIds = [...new Set(actorIdsInput)];
  const assignments: Assignment[] = [];
  const seenActorIds = new Set<number>();
  for (const value of assignmentsInput) {
    if (
      !isRecord(value) ||
      !isPositiveId(value.actor_id) ||
      !isPositiveId(value.voice_actor_id) ||
      !actorIds.includes(value.actor_id) ||
      seenActorIds.has(value.actor_id)
    ) {
      throw createError({
        statusCode: 400,
        message: "Invalid regional assignments",
      });
    }
    seenActorIds.add(value.actor_id);
    assignments.push({
      actor_id: value.actor_id,
      voice_actor_id: value.voice_actor_id,
    });
  }

  if (actorIds.length === 0) return { saved: true, projectId: null };

  const projectId = await findOrCreateDubbingProject(
    contentId,
    contentType,
    dubbingLanguage,
  );
  const supabase = useSupabaseAdmin(event);
  const { error: deleteError } = await supabase
    .from("work")
    .delete()
    .eq("dubbing_project_id", projectId)
    .in("actor_id", actorIds);

  if (deleteError) throw deleteError;

  if (assignments.length > 0) {
    const rows = assignments.map((assignment) => ({
      ...assignment,
      dubbing_project_id: projectId,
      performance: "voice",
      status: "validated",
    }));
    const { error: insertError } = await supabase.from("work").insert(rows);
    if (insertError) throw insertError;
  }

  return { saved: true, projectId };
});
