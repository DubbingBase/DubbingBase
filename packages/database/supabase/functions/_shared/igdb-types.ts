// IGDB-Specific Types (extended, for search/trending/game functions)

// Minimal IGDB supporting types (inlined from media-types.ts)
export interface IgdbCover {
  image_id: string;
  url: string;
}

export interface IgdbPlatform {
  id: number;
  name: string;
  abbreviation: string | null;
}

export interface IgdbInvolvedCompany {
  id: number;
  company: IgdbCompany;
  developer: boolean;
  publisher: boolean;
  porting: boolean;
  supporting: boolean;
}

export interface IgdbCompany {
  id: number;
  name: string;
  logo: string | null;
}

export interface IgdbCharacter {
  id: number;
  name: string;
  mug_shot: IgdbMugShot | null;
}

export interface IgdbMugShot {
  image_id: string;
  url: string;
}

export interface IgdbGame {
  id: number;
  name: string;
  summary: string | null;
  storyline: string | null;
  cover: IgdbCover | null;
  genres: IgdbGenre[];
  platforms: IgdbPlatform[];
  involved_companies: IgdbInvolvedCompany[];
  first_release_date: number | null;
  release_dates: IgdbReleaseDate[];
  websites: IgdbWebsite[];
  screenshots: IgdbScreenshot[];
  videos: IgdbVideo[];
  similar_games: number[];
  parent_game: number | null;
  expansions: number[];
  dlcs: number[];
  standalone_expansions: number[];
  bundles: number[];
  forks: number[];
  follows: number;
  hypes: number;
  rating: number;
  rating_count: number;
  aggregated_rating: number;
  aggregated_rating_count: number;
  total_rating: number;
  total_rating_count: number;
  version_parent: number | null;
  version_title: string | null;
  game_engines: IgdbGameEngine[];
  game_modes: IgdbGameMode[];
  themes: IgdbTheme[];
  player_perspectives: IgdbPlayerPerspective[];
  age_ratings: IgdbAgeRating[];
  multiplayer_modes: IgdbMultiplayerMode[];
  language_supports: IgdbLanguageSupport[];
  alternative_names: IgdbAlternativeName[];
  characters: IgdbCharacter[];
  artworks: IgdbArtwork[];
  franchise: number | null;
  collections: number[];
  game_localizations: IgdbGameLocalization[];
  url: string | null;
  checksum: string;
  created_at: number;
  updated_at: number;
  category: number;
  status: number;
}

export interface IgdbGenre {
  id: number;
  name: string;
  slug: string;
  url: string | null;
  checksum: string;
}

export interface IgdbReleaseDate {
  id: number;
  date: number;
  region: number;
  platform: number | null;
  category: number;
  y: number;
  m: number | null;
  d: number | null;
  human: string;
}

export interface IgdbWebsite {
  id: number;
  category: number;
  url: string;
  trusted: boolean;
}

export interface IgdbScreenshot {
  id: number;
  image_id: string;
  url: string;
}

export interface IgdbVideo {
  id: number;
  video_id: string;
  name: string;
}

export interface IgdbGameEngine {
  id: number;
  name: string;
  slug: string;
  url: string | null;
  checksum: string;
}

export interface IgdbGameMode {
  id: number;
  name: string;
  slug: string;
  url: string | null;
  checksum: string;
}

export interface IgdbTheme {
  id: number;
  name: string;
  slug: string;
  url: string | null;
  checksum: string;
}

export interface IgdbPlayerPerspective {
  id: number;
  name: string;
  slug: string;
  url: string | null;
  checksum: string;
}

export interface IgdbAgeRating {
  id: number;
  category: number;
  rating: number;
  rating_cover_url: string | null;
  synopsis: string | null;
}

export interface IgdbMultiplayerMode {
  id: number;
  campaigncoop: boolean | null;
  dropin: boolean | null;
  lancoop: boolean | null;
  offlinecoop: boolean | null;
  offlinecoopmax: number | null;
  offlinemax: number | null;
  onlinecoop: boolean | null;
  onlinecoopmax: number | null;
  onlinemax: number | null;
  platform: number | null;
  splitscreen: boolean | null;
  splitscreenonline: boolean | null;
}

export interface IgdbLanguageSupport {
  id: number;
  language: IgdbLanguage;
  language_support_type: number;
}

export interface IgdbLanguage {
  id: number;
  name: string;
  code: string;
  locale: string | null;
  native_name: string | null;
}

export interface IgdbAlternativeName {
  id: number;
  name: string;
  comment: string | null;
}

export interface IgdbArtwork {
  id: number;
  image_id: string;
  url: string;
}

export interface IgdbGameLocalization {
  id: number;
  region: number;
  category: number;
}

export interface IgdbFranchise {
  id: number;
  name: string;
  slug: string;
  url: string | null;
  checksum: string;
}

export interface IgdbCollection {
  id: number;
  name: string;
  slug: string;
  url: string | null;
  checksum: string;
}

export interface IgdbSearchResult {
  id: number;
  name: string;
  cover: IgdbCover | null;
  first_release_date: number | null;
  genres: IgdbGenre[];
  platforms: IgdbPlatform[];
  summary: string | null;
  rating: number;
  hypes: number;
  follows: number;
  category: number;
  media_type: "video_game";
}
