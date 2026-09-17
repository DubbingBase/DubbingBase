import { z } from "zod";
import { requireAdmin } from "../../utils/auth";
import { useSupabaseAdmin } from "../../utils/db/client";
import { setNoCacheHeaders } from "../../utils/cache/http";

const querySchema = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const nullableNumber = z.number().nullable();
const workSchema = z.object({
  id: z.number(),
  dubbing_project_id: z.number(),
  actor_id: nullableNumber,
  character_id: nullableNumber,
  voice_actor_id: nullableNumber,
  character_name: z.string().nullable(),
  performance: z.string().nullable(),
  status: z.string().nullable(),
  reviewed_status: z.enum(["waiting", "accepted", "rejected"]).nullable(),
  note: z.string().nullable(),
  highlight: z.boolean().nullable(),
  source_id: nullableNumber,
  sourceName: z.string().nullable(),
  suggestions: z.string().nullable(),
  created_at: z.string().nullable(),
  created_by: z.string().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
  voteCount: z.number(),
  upVotes: z.number(),
  downVotes: z.number(),
  voiceActor: z
    .object({ id: z.number(), firstName: z.string(), lastName: z.string() })
    .nullable(),
});

const responseSchema = z.object({
  items: z.array(
    z.object({
      groupId: z.number(),
      groupSize: z.number(),
      identity: z.object({
        dubbingProjectId: z.number(),
        actorId: nullableNumber,
        characterId: nullableNumber,
        voiceActorId: nullableNumber,
      }),
      project: z.object({
        id: z.number(),
        contentId: z.number(),
        contentType: z.string(),
        language: z.string().nullable(),
      }),
      works: z.array(workSchema),
    }),
  ),
  nextCursor: z.number().nullable(),
  totalGroups: z.number(),
});

export default defineEventHandler(async (event) => {
  setNoCacheHeaders(event);
  requireAdmin(event);
  const parsedQuery = querySchema.safeParse(getQuery(event));
  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      message: "Invalid duplicate scan cursor",
    });
  }

  const supabaseAdmin = useSupabaseAdmin(event);
  const { data, error } = await supabaseAdmin.rpc(
    "find_duplicate_work_groups",
    {
      p_after_group_id: parsedQuery.data.after,
      p_limit: parsedQuery.data.limit,
    },
  );

  if (error) {
    console.error("Failed to scan duplicate work groups:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to scan duplicate work groups",
    });
  }

  const result = responseSchema.safeParse(data);
  if (!result.success) {
    console.error("Duplicate work scan returned an invalid response");
    throw createError({
      statusCode: 500,
      message: "Failed to scan duplicate work groups",
    });
  }

  return result.data;
});
