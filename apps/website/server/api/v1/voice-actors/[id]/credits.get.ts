import * as v from "valibot";
import { defineApiRoute } from "../../../../utils/api-v1/define";
import { ApiError } from "../../../../utils/api-v1/errors";
import { CREDIT_SELECT, Credit, CreditRows, toCredit } from "../../../../utils/api-v1/credits";
import { apiMediaPath, segmentOf } from "../../../../utils/api-v1/media";
import { positiveId } from "../../../../utils/api-v1/voice-actors";
import { useSupabaseAdmin } from "../../../../utils/db/client";

const MAX_LIMIT = 100;

export const route = defineApiRoute({
  summary: "List a voice actor's credits",
  tags: ["Voice actors"],
  scope: "credits:read",
  params: v.object({ id: positiveId }),
  query: v.object({
    limit: v.optional(
      v.pipe(
        v.string(),
        v.regex(/^\d+$/),
        v.transform(Number),
        v.minValue(1),
        v.maxValue(MAX_LIMIT),
      ),
      "50",
    ),
    after: v.optional(positiveId),
  }),
  response: v.object({
    data: v.array(v.object({ ...Credit.entries, media: v.string() })),
    /** Pass as `after` to get the next page; null on the last page. */
    next_cursor: v.nullable(v.string()),
  }),
  handler: async ({ event, params, query }) => {
    const supabase = useSupabaseAdmin(event);
    const { data: actor, error: actorError } = await supabase
      .from("voice_actors")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();
    if (actorError) throw actorError;
    if (!actor) throw new ApiError(404, "not_found", "Voice actor not found.");

    let builder = supabase
      .from("work")
      .select(CREDIT_SELECT)
      .eq("voice_actor_id", params.id)
      .order("id", { ascending: true })
      .limit(query.limit + 1);
    if (query.after !== undefined) builder = builder.gt("id", query.after);
    const { data, error } = await builder;
    if (error) throw error;
    const rows = v.parse(CreditRows, data);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      data: page.flatMap((row) => {
        const media = row.dubbing_projects?.media;
        const segment = media ? segmentOf(media.kind) : null;
        if (!media || !segment) return [];
        return [
          {
            ...toCredit(row, segment, media.content_id),
            media: apiMediaPath(segment, media.content_id),
          },
        ];
      }),
      next_cursor: rows.length > query.limit && last ? String(last.id) : null,
    };
  },
});

export default route.handler;
