import * as v from "valibot";
import { defineApiRoute } from "../../utils/api-v1/define";
import { apiMediaPath, segmentOf } from "../../utils/api-v1/media";

const SearchResult = v.object({
  media_type: v.string(),
  id: v.number(),
  title: v.optional(v.nullable(v.string())),
  name: v.optional(v.nullable(v.string())),
  release_date: v.optional(v.nullable(v.string())),
  first_air_date: v.optional(v.nullable(v.string())),
  first_release_date: v.optional(v.nullable(v.number())),
});

function yearOf(result: v.InferOutput<typeof SearchResult>): number | null {
  const date = result.release_date || result.first_air_date;
  const fromDate = date ? Number.parseInt(date.slice(0, 4), 10) : Number.NaN;
  if (Number.isInteger(fromDate)) return fromDate;
  if (result.first_release_date) return new Date(result.first_release_date * 1000).getUTCFullYear();
  return null;
}

export const route = defineApiRoute({
  summary: "Search media",
  tags: ["Media"],
  scope: "credits:read",
  params: v.object({}),
  query: v.object({
    q: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(100)),
    type: v.optional(
      v.picklist(["movies", "shows", "games", "podcasts", "audiobooks", "advertisements", "toys"]),
    ),
    year: v.optional(v.pipe(v.string(), v.regex(/^\d{4}$/), v.transform(Number))),
  }),
  response: v.object({
    /** Candidates to confirm; `path` is the media's address for every other endpoint. */
    data: v.array(
      v.object({
        type: v.string(),
        id: v.number(),
        title: v.string(),
        year: v.nullable(v.number()),
        path: v.string(),
      }),
    ),
  }),
  handler: async ({ event, query }) => {
    const raw: unknown = await event.$fetch("/api/search", { query: { query: query.q } });
    const items = v.parse(v.array(v.unknown()), raw);
    const data = items.flatMap((item) => {
      const parsed = v.safeParse(SearchResult, item);
      if (!parsed.success) return [];
      const segment = segmentOf(parsed.output.media_type);
      const title = parsed.output.title || parsed.output.name;
      if (!segment || !title) return [];
      if (query.type && query.type !== segment) return [];
      const year = yearOf(parsed.output);
      if (query.year !== undefined && year !== query.year) return [];
      return [
        {
          type: segment,
          id: Math.abs(parsed.output.id),
          title,
          year,
          path: apiMediaPath(segment, parsed.output.id),
        },
      ];
    });
    return { data };
  },
});

export default route.handler;
