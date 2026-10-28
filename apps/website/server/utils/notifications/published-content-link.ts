type PublishedContentType =
  | "movie"
  | "tv"
  | "video_game"
  | "audiobook"
  | "podcast"
  | "advertisement"
  | "toy";

const ROUTE_SEGMENTS: Record<PublishedContentType, string> = {
  movie: "movie",
  tv: "show",
  video_game: "game",
  audiobook: "audiobook",
  podcast: "podcast",
  advertisement: "advertisement",
  toy: "toy",
};

export function publishedContentLink(
  contentType: string,
  contentId: number,
): string | null {
  if (!Number.isSafeInteger(contentId) || contentId === 0) return null;
  const routeSegment = routeSegmentFor(contentType);
  if (!routeSegment) return null;
  if (contentId < 0 && contentType !== "toy" && contentType !== "advertisement") return null;
  return `https://dubbingbase.com/fr/${routeSegment}/${contentId}`;
}

function routeSegmentFor(contentType: string): string | null {
  switch (contentType) {
    case "movie":
      return ROUTE_SEGMENTS.movie;
    case "tv":
      return ROUTE_SEGMENTS.tv;
    case "video_game":
      return ROUTE_SEGMENTS.video_game;
    case "audiobook":
      return ROUTE_SEGMENTS.audiobook;
    case "podcast":
      return ROUTE_SEGMENTS.podcast;
    case "advertisement":
      return ROUTE_SEGMENTS.advertisement;
    case "toy":
      return ROUTE_SEGMENTS.toy;
    default:
      return null;
  }
}
