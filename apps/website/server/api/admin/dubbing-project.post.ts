import { setNoCacheHeaders } from "../../utils/cache/http";
import { requireAdmin } from "../../utils/auth";
import { useSupabaseAdmin } from "../../utils/db/client";
import { requireDubbingLanguage } from "../../utils/dubbing-language";
import type { Json } from "@app/supabase";

const MEDIA_TYPES = [
  "movie",
  "tv",
  "video_game",
  "audiobook",
  "podcast",
  "advertisement",
  "toy",
];

interface AssignmentOperation {
  actor_id: number;
  work_id: number | null;
  expected_voice_actor_id: number | null;
  voice_actor_id: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isOptionalPositiveId(value: unknown): value is number | null {
  return value === null || isPositiveId(value);
}

export default defineEventHandler(async (event) => {
  setNoCacheHeaders(event);
  requireAdmin(event);
  const body: unknown = await readBody(event);
  if (!isRecord(body)) {
    throw createError({ statusCode: 400, message: "Invalid request body" });
  }

  const contentId = body.content_id;
  const contentType = body.content_type;
  const dubbingLanguage = requireDubbingLanguage(body.dubbing_language);
  const operationsInput = body.operations;

  if (
    !isPositiveId(contentId) ||
    typeof contentType !== "string" ||
    !MEDIA_TYPES.includes(contentType) ||
    !Array.isArray(operationsInput) ||
    operationsInput.length === 0
  ) {
    throw createError({
      statusCode: 400,
      message: "Invalid regional assignment operations",
    });
  }

  const operations: AssignmentOperation[] = [];
  const seenActorIds = new Set<number>();
  for (const value of operationsInput) {
    if (
      !isRecord(value) ||
      !isPositiveId(value.actor_id) ||
      !isOptionalPositiveId(value.work_id) ||
      !isOptionalPositiveId(value.expected_voice_actor_id) ||
      !isOptionalPositiveId(value.voice_actor_id) ||
      (value.work_id === null &&
        (value.voice_actor_id === null ||
          value.expected_voice_actor_id !== null)) ||
      seenActorIds.has(value.actor_id)
    ) {
      throw createError({
        statusCode: 400,
        message: "Invalid regional assignment operations",
      });
    }
    seenActorIds.add(value.actor_id);
    operations.push({
      actor_id: value.actor_id,
      work_id: value.work_id,
      expected_voice_actor_id: value.expected_voice_actor_id,
      voice_actor_id: value.voice_actor_id,
    });
  }

  const supabase = useSupabaseAdmin(event);
  const { data: projectId, error } = await supabase.rpc(
    "save_regional_project_actor_assignments",
    {
      p_content_id: contentId,
      p_content_type: contentType,
      p_dubbing_language: dubbingLanguage,
      p_operations: operations.map((operation): Json => ({
        actor_id: operation.actor_id,
        work_id: operation.work_id,
        expected_voice_actor_id: operation.expected_voice_actor_id,
        voice_actor_id: operation.voice_actor_id,
      })),
    },
  );

  if (error?.code === "55000" || error?.code === "40001") {
    throw createError({
      statusCode: 409,
      message:
        "Assignments changed or multiple works make this actor non-editable; reload before saving",
    });
  }
  if (error) throw error;

  return { saved: true, projectId };
});
