/**
 * DubbingBase media references.
 *
 * `dubbing_projects`, `toy_metadata` and `game_characters` point at `media` by `media_id`. The website and API still
 * speak a reference `(contentType, contentId)`: the id the website uses for the kind (TMDB id for movie/tv, IGDB id for
 * video_game, Open Library work number for audiobook, iTunes id for podcast) and `media.id` itself for
 * toy/advertisement, which are DubbingBase's own media. `media.content_id` stores exactly that value, so the pair is
 * unique and needs no special casing. This module is the single place that converts between the two.
 */
export const MEDIA_KINDS = [
  "movie",
  "tv",
  "video_game",
  "audiobook",
  "podcast",
  "advertisement",
  "toy",
] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** PostgREST select fragment that embeds the media of a row that has `media_id`. */
export const MEDIA_EMBED = "media:media_id(id,kind,content_id)";

/** Same, as an inner join: required to filter rows by `media.*` (see `mediaRefFilters`). */
export const MEDIA_FILTER_EMBED = "media:media_id!inner(id,kind,content_id)";

export interface MediaEmbed {
  id: number;
  kind: string;
  content_id: number;
}

export interface MediaRef {
  mediaId: number;
  contentType: MediaKind;
  contentId: number;
}

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === "string" && MEDIA_KINDS.some((kind) => kind === value);
}

/** Convert an embedded media row to the website's reference, or null when its kind is unknown. */
export function mediaRefFromEmbed(media: MediaEmbed | null | undefined): MediaRef | null {
  if (!media || !isMediaKind(media.kind)) return null;
  return { mediaId: media.id, contentType: media.kind, contentId: media.content_id };
}

/**
 * `.eq(column, value)` pairs selecting the rows whose media is the given reference. Requires the select to include
 * `MEDIA_FILTER_EMBED`.
 *
 *   let query = client.from("dubbing_projects").select(`id,${MEDIA_FILTER_EMBED}`);
 *   for (const [column, value] of mediaRefFilters(kind, contentId)) query = query.eq(column, value);
 */
export function mediaRefFilters(
  kind: MediaKind,
  contentId: number,
): readonly (readonly [string, string | number])[] {
  return [
    ["media.kind", kind],
    ["media.content_id", contentId],
  ];
}

/** Restrict a query (selected with `MEDIA_FILTER_EMBED`) to the rows of one media reference. */
export function eqMediaRef<Q extends { eq: (column: string, value: string | number) => Q }>(
  query: Q,
  kind: MediaKind,
  contentId: number,
): Q {
  let filtered = query;
  for (const [column, value] of mediaRefFilters(kind, contentId)) {
    filtered = filtered.eq(column, value);
  }
  return filtered;
}
