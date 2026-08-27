/** IGDB image cover object */
export interface IgdbCover {
  image_id: string;
  url?: string;
}

/** IGDB character mug shot */
export interface IgdbMugShot {
  image_id: string;
  url?: string;
}

export interface IgdbGenre {
  id: number;
  name: string;
}

export interface IgdbPlatform {
  id: number;
  name: string;
  slug?: string;
}

export interface IgdbCompany {
  id: number;
  name: string;
}

export interface IgdbInvolvedCompany {
  id: number;
  company: IgdbCompany;
  developer: boolean;
  publisher: boolean;
}

/** A video game from IGDB, with processed image URLs */
export interface IgdbGame {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  rating?: number;
  rating_count?: number;
  /** Unix timestamp in seconds */
  first_release_date?: number;
  cover?: IgdbCover;
  artworks?: { id?: number; image_id: string; url?: string }[];
  screenshots?: { id?: number; image_id: string; url?: string }[];
  genres?: IgdbGenre[];
  platforms?: IgdbPlatform[];
  involved_companies?: IgdbInvolvedCompany[];
  media_type: "video_game";
}

/** A game character from IGDB */
export interface IgdbCharacter {
  id: number;
  name: string;
  description?: string;
  mug_shot?: IgdbMugShot;
  gender?: number;
  games?: number[];
}

/** Response shape from the `game` edge function */
export interface GameResponse {
  game: IgdbGame | null;
  characters: IgdbCharacter[];
  dubbingProjects: any[];
  votes: Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  >;
}
