import * as v from "valibot";
import { defineApiRoute } from "../../../../../utils/api-v1/define";
import {
  CREDIT_SELECT,
  Credit,
  CreditRows,
  requireMedia,
  toCredit,
} from "../../../../../utils/api-v1/credits";
import {
  dubbingLanguage,
  mediaKey,
  mediaParams,
  apiMediaPath,
} from "../../../../../utils/api-v1/media";
import { positiveId } from "../../../../../utils/api-v1/voice-actors";
import { useSupabaseAdmin } from "../../../../../utils/db/client";

const MAX_LIMIT = 100;

export const route = defineApiRoute({
  summary: "List a media entry's credits",
  tags: ["Credits"],
  scope: "credits:read",
  params: mediaParams,
  query: v.object({
    language: v.optional(dubbingLanguage),
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
    path: v.string(),
    data: v.array(Credit),
    /** Pass as `after` to get the next page; null on the last page. */
    next_cursor: v.nullable(v.string()),
  }),
  handler: async ({ event, params, query }) => {
    const key = mediaKey(params.type, params.id);
    await requireMedia(event, key);
    const supabase = useSupabaseAdmin(event);
    let projects = supabase
      .from("dubbing_projects")
      .select("id")
      .eq("content_type", key.contentType)
      .eq("content_id", key.contentId);
    if (query.language) projects = projects.eq("language", query.language);
    const { data: projectRows, error: projectError } = await projects;
    if (projectError) throw projectError;
    const path = `${apiMediaPath(key.segment, key.contentId)}/credits`;
    const projectIds = (projectRows ?? []).map((project) => project.id);
    if (projectIds.length === 0) return { path, data: [], next_cursor: null };

    let builder = supabase
      .from("work")
      .select(CREDIT_SELECT)
      .in("dubbing_project_id", projectIds)
      .order("id", { ascending: true })
      .limit(query.limit + 1);
    if (query.after !== undefined) builder = builder.gt("id", query.after);
    const { data, error } = await builder;
    if (error) throw error;
    const rows = v.parse(CreditRows, data);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      path,
      data: page.map((row) => toCredit(row, key.segment, key.contentId)),
      next_cursor: rows.length > query.limit && last ? String(last.id) : null,
    };
  },
});

export default route.handler;
