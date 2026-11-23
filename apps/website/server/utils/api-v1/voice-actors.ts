import type { Tables } from "@app/shared-logic";
import * as v from "valibot";

type VoiceActorRow = Tables<"voice_actors">;

/** The voice_actors columns the public API exposes; a name that is not a column fails to compile. */
const VOICE_ACTOR_FIELDS = [
  "id",
  "firstname",
  "lastname",
  "bio",
  "nationality",
  "date_of_birth",
  "awards",
  "years_active",
  "social_media_links",
  "profile_picture",
  "tmdb_id",
  "wikidata_id",
  "updated_at",
] as const satisfies readonly (keyof VoiceActorRow)[];

export const VOICE_ACTOR_COLUMNS = VOICE_ACTOR_FIELDS.join(", ");

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const Json: v.GenericSchema<JsonValue> = v.lazy(() =>
  v.union([
    v.string(),
    v.number(),
    v.boolean(),
    v.null(),
    v.array(Json),
    v.record(v.string(), Json),
  ]),
);

/**
 * One schema per exposed column, each checked against that column's type in the generated
 * database types: a missing, extra or mistyped entry fails to compile.
 */
const voiceActorShape = {
  id: v.number(),
  firstname: v.string(),
  lastname: v.string(),
  bio: v.nullable(v.string()),
  nationality: v.nullable(v.string()),
  date_of_birth: v.nullable(v.string()),
  awards: v.nullable(v.string()),
  years_active: v.nullable(v.string()),
  social_media_links: v.nullable(Json),
  profile_picture: v.nullable(v.string()),
  tmdb_id: v.nullable(v.number()),
  wikidata_id: v.nullable(v.string()),
  updated_at: v.nullable(v.string()),
} satisfies { [K in (typeof VOICE_ACTOR_FIELDS)[number]]: v.GenericSchema<VoiceActorRow[K]> };

export const VoiceActor = v.object(voiceActorShape);

/** A positive id from a path or cursor, rejected when `Number` could not hold it exactly. */
export const positiveId = v.pipe(
  v.string(),
  v.regex(/^[1-9]\d{0,15}$/, "must be a positive integer"),
  v.transform(Number),
  v.safeInteger("must be a safe integer"),
);
