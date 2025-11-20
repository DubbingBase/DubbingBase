import { RegexGroupKeys } from "./regex.ts";

export interface ResponseParseWikiText {
  parse: ParseWikiText;
}

export interface ResponseSearchEntities {
  search: Array<{
    id: string
    title: string
    concepturi: string
  }>
}

export interface ResponseFetchFile {
  query: {
    pages: {
      [index: number]: {
        imageinfo: {
          [index: number]: {
            url: string
          }
        }
      }
    }
  }
}

export interface ResponseGetEntity {
  entities: {
    [index: string]: {
      claims: {
        /** Image */
        P18: Array<{
          mainsnak: {
            datavalue: {
              value: string
            }
          }
        }>
        /** Birth date */
        P569: Array<{
          mainsnak: {
            datavalue: {
              value: {
                time: string
              }
            }
          }
        }>
      }
    }
  }
}

export interface ParseWikiText {
  title: string;
  pageid: number;
  wikitext: string;
}

export interface ResponseParseText {
  parse: ParseText;
}

export interface ParseText {
  title: string;
  pageid: number;
  text: string;
  wikitext: string;
}

export interface ResponseParseSections {
  parse: Parse;
}

export interface Parse {
  title: string;
  pageid: number;
  sections: Section[];
  showtoc: boolean;
}

export interface Section {
  toclevel: number;
  level: string;
  line: string;
  number: string;
  index: string;
  fromtitle: string;
  byteoffset: number;
  anchor: string;
  linkAnchor: string;
}

export interface ResponseCategoryList {
  batchcomplete: string;
  continue?: Continue;
  query: Query;
}

export interface Continue {
  cmcontinue: string;
  continue: string;
}

export interface Query {
  categorymembers: Categorymember[];
}

export interface Categorymember {
  pageid: number;
  ns: number;
  title: string;
}

export type ElementType = 'movie' | 'show' | 'videogame' | 'generic'

export type LineType = 'multiline' | 'single'

export interface FakeMatchedGroups {
  groups: {
    actor_link: string | undefined;
    actor_name: string | undefined;
    year: string | undefined;
    apparitions: string | undefined
    media_title: string | undefined;
  };
}

export interface FullElement {
  pageId: number;
  title: string;
  profilePictureFileId: string | undefined
  birthDate: string
  html: string;
  wiki: string;
  type: ElementType
}

export type QueueElement = string;

export interface MovieElement {
  voiceActorName: string

  actorName?: string
  movieName: string

  movieId?: string
  actorId?: string

  year?: string
  type: 'movie'
  origin?: Origin
}

export interface ApparitionEpisode {
  type: 'episode'
  season: number
  episode: number
}

export interface ApparitionSeason {
  type: 'season'
  season: number
}

export interface ApparitionSeasonRange {
  type: 'season-range'
  fromSeason: number
  toSeason: number
}

export interface ApparitionEpisodeRange {
  type: 'episode-range'
  season: number
  fromEpisode: number
  toEpisode: number
}

export interface ApparitionYearRange {
  type: 'year-range'
  fromYear: number
  toYear: number
}

export type Apparition =
  | ApparitionEpisode
  | ApparitionSeason
  | ApparitionSeasonRange
  | ApparitionEpisodeRange
  | ApparitionYearRange

export interface Origin {
  source: string
  acceptedRegex: string
  regexList: any
  lineType: string
  parent?: string
}

export type ElementMatches = { [key in RegexGroupKeys]: string };

export interface ShowElement {
  voiceActorName: string

  actorName?: string
  actorId?: string

  showName: string
  showId?: string

  apparitions: Array<Apparition>
  year?: string
  type: 'show'
  origin?: Origin
}

export interface VideoGameElement {
  voiceActorName: string

  actorName: string
  actorId?: string

  videoGameName: string
  videoGameId?: string

  year: string
  type: 'videogame'
  origin?: Origin
}

export interface GenericElement {
  voiceActorName: string

  actorName: string
  actorId? :string

  mediaName: string
  mediaId?: string

  year: string
  type: 'generic'
  origin?: Origin
}

export type JSONElement =
  | MovieElement
  | ShowElement
  // | VideoGameElement
  // | GenericElement

export type JSONElementBase = Omit<JSONElement, 'origin'>

export type Match = {
  keysMatched: number;
  data: Array<JSONElement>;
};