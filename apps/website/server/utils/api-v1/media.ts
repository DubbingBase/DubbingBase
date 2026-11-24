import { DUBBING_LANGUAGE_OPTIONS } from "@app/shared-logic";
import * as v from "valibot";
import type { DubbingProjectMediaType } from "../../../src/utils/dubbing-project-save";
import { positiveId } from "./voice-actors";

/** Public path segment of each media type → the `media.kind` it is stored under. */
export const MEDIA_TYPES = {
  movies: "movie",
  shows: "tv",
  games: "video_game",
  podcasts: "podcast",
  audiobooks: "audiobook",
  advertisements: "advertisement",
  toys: "toy",
} as const satisfies Record<string, DubbingProjectMediaType>;

export type MediaSegment = keyof typeof MEDIA_TYPES;

const SEGMENTS = [
  "movies",
  "shows",
  "games",
  "podcasts",
  "audiobooks",
  "advertisements",
  "toys",
] as const satisfies readonly MediaSegment[];

export const mediaSegment = v.picklist(SEGMENTS);
export const internalSegment = v.picklist(["advertisements", "toys"]);

export const mediaParams = v.object({ type: mediaSegment, id: positiveId });

/** Regional dubbing language: a picklist, so the OpenAPI document lists every allowed value. */
export const dubbingLanguage = v.pipe(
  v.picklist(
    DUBBING_LANGUAGE_OPTIONS,
    `must be a regional dubbing language code such as fr-FR (one of: ${DUBBING_LANGUAGE_OPTIONS.join(", ")})`,
  ),
  v.description(
    "Regional dubbing language code, language-REGION such as fr-FR or fr-CA (not a bare language like fr).",
  ),
);

export const PERFORMANCES = [
  "dialogues",
  "chant",
  "dialogues & chant",
  "bruitages",
  "narration",
  "ambiances",
  "voice",
] as const;

export const performanceSchema = v.picklist(PERFORMANCES);

export interface MediaKey {
  segment: MediaSegment;
  contentType: DubbingProjectMediaType;
  /** The reference id: the provider id, or `media.id` for advertisements and toys. */
  contentId: number;
}

export function mediaKey(segment: MediaSegment, id: number): MediaKey {
  return {
    segment,
    contentType: MEDIA_TYPES[segment],
    contentId: id,
  };
}

/** The website page of a media entry, for links sent to people (the API path needs a token). */
export function sitePath(segment: MediaSegment, contentId: number): string {
  const page = {
    movies: "movie",
    shows: "show",
    games: "game",
    podcasts: "podcast",
    audiobooks: "audiobook",
    advertisements: "advertisement",
    toys: "toy",
  } as const satisfies Record<MediaSegment, string>;
  return `/${page[segment]}/${contentId}`;
}

export function apiMediaPath(segment: MediaSegment, contentId: number): string {
  return `/api/v1/${segment}/${contentId}`;
}

export function segmentOf(contentType: string): MediaSegment | null {
  return SEGMENTS.find((segment) => MEDIA_TYPES[segment] === contentType) ?? null;
}
