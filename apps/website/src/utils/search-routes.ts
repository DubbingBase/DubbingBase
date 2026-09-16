import type { SearchResult } from "@app/shared-logic";

export type SearchFilter = "all" | SearchResult["media_type"];

const SEARCH_RESULT_ROUTE_PREFIXES: Record<SearchResult["media_type"], string> =
  {
    movie: "movie",
    tv: "show",
    person: "actor",
    voice_actor: "voice-actor",
    video_game: "game",
    audiobook: "audiobook",
    podcast: "podcast",
    advertisement: "advertisement",
    toy: "toy",
  };

export function getSearchResultRoute(
  result: Pick<SearchResult, "id" | "media_type">,
): string {
  return `/${SEARCH_RESULT_ROUTE_PREFIXES[result.media_type]}/${result.id}`;
}
