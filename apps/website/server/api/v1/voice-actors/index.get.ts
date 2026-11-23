import * as v from "valibot";
import { defineApiRoute } from "../../../utils/api-v1/define";
import { positiveId, VoiceActor, VOICE_ACTOR_COLUMNS } from "../../../utils/api-v1/voice-actors";
import { useSupabaseAdmin } from "../../../utils/db/client";

const MAX_LIMIT = 100;

export const route = defineApiRoute({
  summary: "List voice actors",
  tags: ["Voice actors"],
  scope: "voice-actors:read",
  params: v.object({}),
  query: v.object({
    limit: v.optional(
      v.pipe(
        v.string(),
        v.regex(/^\d+$/),
        v.transform(Number),
        v.minValue(1),
        v.maxValue(MAX_LIMIT),
      ),
      "25",
    ),
    after: v.optional(positiveId),
  }),
  response: v.object({
    data: v.array(VoiceActor),
    /** Pass as `after` to get the next page; null on the last page. */
    next_cursor: v.nullable(v.string()),
  }),
  handler: async ({ event, query }) => {
    let builder = useSupabaseAdmin(event)
      .from("voice_actors")
      .select(VOICE_ACTOR_COLUMNS)
      .order("id", { ascending: true })
      .limit(query.limit + 1);
    if (query.after !== undefined) builder = builder.gt("id", query.after);
    const { data, error } = await builder;
    if (error) throw error;
    const rows = v.parse(v.array(VoiceActor), data);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      data: page,
      next_cursor: rows.length > query.limit && last ? String(last.id) : null,
    };
  },
});

export default route.handler;
