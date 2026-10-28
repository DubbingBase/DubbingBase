import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@app/shared-logic";

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

export function publishedContentLink(contentType: string, contentId: number): string | null {
  if (!Number.isSafeInteger(contentId) || contentId === 0) return null;
  const routeSegment = routeSegmentFor(contentType);
  if (!routeSegment) return null;
  if (contentId < 0 && contentType !== "toy" && contentType !== "advertisement") return null;
  return `https://dubbingbase.com/${routeSegment}/${contentId}`;
}

export function localizePublishedContentLink(link: string, locale: string): string | null {
  try {
    const url = new URL(link);
    if (url.origin !== "https://dubbingbase.com") return null;
    const supportedLocale =
      SUPPORTED_LOCALES.find((candidate) => candidate === locale) ?? DEFAULT_LOCALE;
    if (supportedLocale !== DEFAULT_LOCALE) {
      url.pathname = `/${supportedLocale}${url.pathname}`;
    }
    return url.href;
  } catch {
    return null;
  }
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
