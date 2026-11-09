import { readProperty } from "@app/shared-logic";

export type SearchItem = {
  [key: string]: unknown;
  id?: string | number | null;
  title?: string | null;
  name?: string | null;
  voice_actor_name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  popularity?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
  first_release_date?: number | null;
  studio_names?: string[];
  /** 0-based position in the item's own provider list (provider relevance order). Never returned. */
  provider_rank?: number;
  tmdb_id?: number | null;
  profile_picture?: string | null;
  profile_path?: string | null;
  media_type?: string;
  score?: number;
};

/**
 * Relative weight of each media type when provider lists are merged. Order decided in 56365-135:
 * voice actors > movies = shows > games > people > books = ads = everything else.
 */
export const MEDIA_TYPE_WEIGHTS: Readonly<Record<string, number>> = {
  voice_actor: 1.5,
  movie: 1,
  tv: 1,
  video_game: 0.8,
  person: 0.6,
};
export const DEFAULT_MEDIA_TYPE_WEIGHT = 0.4;

/** Reciprocal Rank Fusion constant: small, because provider lists are short (20-40 items). */
export const RRF_K = 5;

/**
 * Merges the providers' own relevance orders into one list with weighted Reciprocal Rank
 * Fusion. DubbingBase adds no text matching or quality formulas: each provider decides what is
 * relevant within its list, and only the media-type weights decide how the lists interleave.
 * Ties fall back to the provider's popularity, then media type and ID, so the order is
 * deterministic regardless of arrival order.
 */
export function rankSearchResults(items: SearchItem[]): SearchItem[] {
  return items
    .filter((item) => item != null)
    .map(({ provider_rank, ...item }) => {
      const weight = MEDIA_TYPE_WEIGHTS[item.media_type ?? ""] ?? DEFAULT_MEDIA_TYPE_WEIGHT;
      const position =
        typeof provider_rank === "number" && Number.isFinite(provider_rank)
          ? Math.max(0, provider_rank)
          : null;
      return { ...item, score: position === null ? 0 : weight / (RRF_K + position) };
    })
    .sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
        (b.popularity ?? 0) - (a.popularity ?? 0) ||
        String(a.media_type ?? "").localeCompare(String(b.media_type ?? "")) ||
        String(a.id ?? "").localeCompare(String(b.id ?? ""), undefined, { numeric: true }),
    );
}

export function getTmdbLocale(locale: unknown): string {
  if (locale === "fr") return "fr-FR";
  if (locale === "es") return "es-ES";
  if (locale === "ja") return "ja-JP";
  return "en-US";
}

export function projectSearchResult(item: SearchItem): SearchItem {
  const cover = item.cover;
  const coverUrl =
    typeof cover === "object" && cover !== null && !Array.isArray(cover)
      ? readProperty(cover, "url")
      : undefined;

  return {
    id: item.id,
    media_type: item.media_type,
    title: item.title,
    name: item.name,
    voice_actor_name: item.voice_actor_name,
    firstname: item.firstname,
    lastname: item.lastname,
    profile_path: item.profile_path,
    poster_path: item.poster_path,
    popularity: item.popularity,
    score: item.score,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    first_release_date: item.first_release_date,
    original_title: item.original_title,
    original_name: item.original_name,
    studio_names: item.studio_names,
    ...(typeof coverUrl === "string" ? { cover: { url: coverUrl } } : {}),
    author_name: item.author_name,
    brand: item.brand,
    manufacturer: item.manufacturer,
    product_line: item.product_line,
    overview: item.overview,
  };
}
