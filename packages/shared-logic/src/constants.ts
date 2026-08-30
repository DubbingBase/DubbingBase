export const DEFAULT_LOCALE = "en" as const;

export const SUPPORTED_LOCALES = ["en", "fr", "es", "ja"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const NON_DEFAULT_LOCALES = ["fr", "es", "ja"] as const;
export type NonDefaultLocale = (typeof NON_DEFAULT_LOCALES)[number];

export interface LocaleConfig {
  code: SupportedLocale;
  language: string;
  file: string;
  name: string;
}

export const APP_LOCALES: readonly LocaleConfig[] = [
  { code: "en", language: "en-US", file: "en.json", name: "English" },
  { code: "fr", language: "fr-FR", file: "fr.json", name: "Français" },
  { code: "es", language: "es-ES", file: "es.json", name: "Español" },
  { code: "ja", language: "ja-JP", file: "ja.json", name: "日本語" },
] as const;

export const MEDIA_TYPES = [
  "movie",
  "tv",
  "season",
  "episode",
  "video_game",
  "audiobook",
  "podcast",
  "advertisement",
  "toy",
] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_ROUTE_PREFIXES = [
  "movie",
  "show",
  "game",
  "actor",
  "voice-actor",
  "audiobook",
  "podcast",
  "toy",
  "advertisement",
  "studio",
  "movies",
  "series",
  "voice-actors",
  "studios",
] as const;
export type MediaRoutePrefix = (typeof MEDIA_ROUTE_PREFIXES)[number];

export const API_CLIENT_HEADER = "x-dubbingbase-client" as const;
export const API_CLIENT_VALUE = "web" as const;
