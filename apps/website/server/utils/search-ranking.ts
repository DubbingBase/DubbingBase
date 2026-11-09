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
  /** Set on TMDB's own best movie/TV hit; TMDB already matched titles/aliases. Never returned. */
  provider_top_match?: boolean;
  tmdb_id?: number | null;
  profile_picture?: string | null;
  profile_path?: string | null;
  media_type?: string;
  score?: number;
};

const foldAccents = (value: string): string =>
  value.normalize("NFKD").replace(/(\p{Script=Latin})\p{M}+/gu, "$1");

const normalizeSearchText = (value: string): string =>
  foldAccents(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function getSearchNames(item: SearchItem): string[] {
  return [
    item.title,
    item.name,
    item.voice_actor_name,
    item.original_title,
    item.original_name,
    typeof item.product_line === "string" ? item.product_line : "",
    typeof item.manufacturer === "string" ? item.manufacturer : "",
    typeof item.brand === "string" ? item.brand : "",
    typeof item.firstname === "string" && typeof item.lastname === "string"
      ? `${item.firstname} ${item.lastname}`
      : "",
  ].filter((name): name is string => typeof name === "string" && name.length > 0);
}

function getMatchTier(item: SearchItem, query: string): "exact" | "prefix" | "contains" | "none" {
  // TMDB matches alternate/translated titles itself but returns only one localized title,
  // so its top hit is trusted as an exact match instead of re-deriving it from that title.
  if (item.provider_top_match) return "exact";
  const queryHasPunctuation = /[^\p{L}\p{N}\s]/u.test(query);
  const normalizedQuery = foldAccents(query).toLowerCase().replace(/\s+/g, " ").trim();
  const names = getSearchNames(item).map((name) => ({
    strict: foldAccents(name).toLowerCase().replace(/\s+/g, " ").trim(),
    loose: normalizeSearchText(name),
  }));
  const looseQuery = normalizeSearchText(query);
  const isMatch = (name: (typeof names)[number], test: (value: string) => boolean): boolean =>
    queryHasPunctuation ? test(name.strict) : test(name.loose);
  const exact = names.some((name) =>
    isMatch(name, (value) => value === (queryHasPunctuation ? normalizedQuery : looseQuery)),
  );
  const prefix = names.some((name) =>
    isMatch(name, (value) => value.startsWith(queryHasPunctuation ? normalizedQuery : looseQuery)),
  );
  const contains = names.some((name) =>
    isMatch(name, (value) => value.includes(queryHasPunctuation ? normalizedQuery : looseQuery)),
  );

  return exact ? "exact" : prefix ? "prefix" : contains ? "contains" : "none";
}

function calculateScore(item: SearchItem, query: string, now: number): number {
  const tier = getMatchTier(item, query);
  let score = tier === "exact" ? 3000 : tier === "prefix" ? 2000 : tier === "contains" ? 1000 : 0;
  score += Math.min(Math.sqrt(item.popularity || 0) * 3, 50);
  score += Math.min((item.vote_average || 0) * 0.1, 1);
  score += Math.min(Math.log10((item.vote_count || 0) + 1) * 3, 15);

  let releaseMs: number | null = null;
  const isoDate = item.release_date || item.first_air_date;
  if (isoDate) releaseMs = new Date(isoDate).getTime();
  else if (typeof item.first_release_date === "number") releaseMs = item.first_release_date * 1000;

  if (releaseMs && !Number.isNaN(releaseMs)) {
    const ageYears = Math.max(0, (now - releaseMs) / (365.25 * 24 * 3600 * 1000));
    // Items with no popularity or vote evidence (e.g. most books) get half the recency
    // bonus so a fresh, unrated record does not outrank an established exact match.
    const hasEvidence = (item.popularity ?? 0) > 0 || (item.vote_count ?? 0) > 0;
    score += Math.max(0, 15 - ageYears * 1.5) * (hasEvidence ? 1 : 0.5);
  }

  return score;
}

export function rankSearchResults(
  items: SearchItem[],
  query: string,
  now = Date.now(),
): SearchItem[] {
  return items
    .filter((item) => item != null)
    .map(({ provider_top_match, ...item }) => ({
      ...item,
      score: calculateScore({ ...item, provider_top_match }, query, now),
    }))
    .sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
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
