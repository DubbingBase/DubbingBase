import { isDubbingLanguage, type DubbingLanguage } from "@app/shared-logic";
import * as v from "valibot";
import type { DubbingProjectMediaType } from "../../../src/utils/dubbing-project-save";
import { positiveId } from "./voice-actors";

/** Public path segment of each media type → the `dubbing_projects.content_type` it is stored under. */
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

/** Ads and toys are internal entries stored under negative ids; the API shows them unsigned. */
const INTERNAL_SEGMENTS: readonly MediaSegment[] = ["advertisements", "toys"];

export const mediaSegment = v.picklist(SEGMENTS);
export const internalSegment = v.picklist(["advertisements", "toys"]);

export const mediaParams = v.object({ type: mediaSegment, id: positiveId });

export const dubbingLanguage = v.custom<DubbingLanguage>(
  isDubbingLanguage,
  "must be a regional dubbing language such as fr-FR",
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
  /** The `content_id` stored on dubbing projects (negative for internal media). */
  contentId: number;
}

export function mediaKey(segment: MediaSegment, id: number): MediaKey {
  return {
    segment,
    contentType: MEDIA_TYPES[segment],
    contentId: INTERNAL_SEGMENTS.includes(segment) ? -id : id,
  };
}

export function apiMediaPath(segment: MediaSegment, contentId: number): string {
  return `/api/v1/${segment}/${Math.abs(contentId)}`;
}

export function segmentOf(contentType: string): MediaSegment | null {
  return SEGMENTS.find((segment) => MEDIA_TYPES[segment] === contentType) ?? null;
}

/** A fresh UUID per batch item, stable across retries: the same key and index give the same id. */
export async function deriveRequestId(key: string, index: number): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`api-v1-credit:${key}:${index}`),
  );
  const hex = Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  );
  hex[6] = ((Number.parseInt(hex[6] ?? "0", 16) & 0x0f) | 0x40).toString(16).padStart(2, "0");
  hex[8] = ((Number.parseInt(hex[8] ?? "0", 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20, 32)}`;
}
