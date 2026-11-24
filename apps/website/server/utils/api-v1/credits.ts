import type { H3Event } from "h3";
import { eqMediaRef, MEDIA_EMBED, MEDIA_FILTER_EMBED, readProperty } from "@app/shared-logic";
import { asString } from "../narrow";
import * as v from "valibot";
import { useSupabaseAdmin } from "../db/client";
import { ApiError } from "./errors";
import { apiMediaPath, performanceSchema, type MediaKey } from "./media";
import { validateMediaReference } from "../media-reference";

export const CreditActor = v.object({
  id: v.number(),
  path: v.string(),
  firstname: v.string(),
  lastname: v.string(),
});

/** One cast credit: who voices a character in one language of one media. */
export const Credit = v.object({
  id: v.number(),
  path: v.string(),
  language: v.string(),
  character_name: v.nullable(v.string()),
  voice_actor: v.nullable(CreditActor),
  /** The provider's id for the on-screen cast member (TMDB person or IGDB character), if any. */
  actor_id: v.nullable(v.number()),
  game_character_id: v.nullable(v.string()),
  performance: v.nullable(performanceSchema),
  note: v.nullable(v.string()),
  highlight: v.nullable(v.boolean()),
  /** `waiting`, `accepted` or `rejected`: whether a trusted editor has verified the credit. */
  reviewed_status: v.nullable(v.string()),
  updated_at: v.string(),
});

export type CreditOutput = v.InferOutput<typeof Credit>;

export const CREDIT_SELECT = `id, dubbing_project_id, character_name, actor_id, game_character_id, performance, note, highlight, reviewed_status, updated_at, voice_actors(id, firstname, lastname), dubbing_projects(language, ${MEDIA_EMBED})`;

const CreditRow = v.object({
  id: v.number(),
  character_name: v.nullable(v.string()),
  actor_id: v.nullable(v.number()),
  game_character_id: v.nullable(v.string()),
  performance: v.nullable(v.string()),
  note: v.nullable(v.string()),
  highlight: v.nullable(v.boolean()),
  reviewed_status: v.nullable(v.string()),
  updated_at: v.string(),
  voice_actors: v.nullable(
    v.object({ id: v.number(), firstname: v.string(), lastname: v.string() }),
  ),
  dubbing_projects: v.nullable(
    v.object({
      language: v.string(),
      media: v.nullable(v.object({ id: v.number(), kind: v.string(), content_id: v.number() })),
    }),
  ),
});

export const CreditRows = v.array(CreditRow);

export function toCredit(
  row: v.InferOutput<typeof CreditRow>,
  segment: Parameters<typeof apiMediaPath>[0],
  contentId: number,
): CreditOutput {
  const known = v.safeParse(performanceSchema, row.performance);
  return {
    id: row.id,
    path: `${apiMediaPath(segment, contentId)}/credits/${row.id}`,
    language: row.dubbing_projects?.language ?? "",
    character_name: row.character_name,
    voice_actor: row.voice_actors
      ? { ...row.voice_actors, path: `/api/v1/voice-actors/${row.voice_actors.id}` }
      : null,
    actor_id: row.actor_id,
    game_character_id: row.game_character_id,
    performance: known.success ? known.output : null,
    note: row.note,
    highlight: row.highlight,
    reviewed_status: row.reviewed_status,
    updated_at: row.updated_at,
  };
}

/**
 * Confirms the media exists: it needs dubbing projects already, or (for provider media) to
 * exist at the provider so a first credit may create its project. Unknown media is a 404.
 */
export async function requireMedia(event: H3Event, key: MediaKey): Promise<void> {
  const supabase = useSupabaseAdmin(event);
  const { data, error } = await eqMediaRef(
    supabase.from("dubbing_projects").select(`id, ${MEDIA_FILTER_EMBED}`),
    key.contentType,
    key.contentId,
  )
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return;
  if (key.contentType !== "advertisement" && key.contentType !== "toy") {
    try {
      await validateMediaReference(event, {
        media_type: key.contentType,
        media_id: key.contentId,
        actor_id: null,
        game_character_id: null,
      });
      return;
    } catch (cause) {
      if (isStatus(cause, 422)) throw new ApiError(404, "not_found", "Media not found.");
      throw new ApiError(503, "provider_unavailable", "The media provider could not be reached.");
    }
  }
  throw new ApiError(404, "not_found", "Media not found.");
}

export function isStatus(error: unknown, status: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === status
  );
}

/** Looks up the credit and checks it belongs to the media in the path. */
export async function requireCredit(event: H3Event, key: MediaKey, workId: number) {
  const supabase = useSupabaseAdmin(event);
  const { data, error } = await supabase
    .from("work")
    .select(CREDIT_SELECT)
    .eq("id", workId)
    .maybeSingle();
  if (error) throw error;
  const row = v.parse(v.nullable(CreditRow), data);
  const project = row?.dubbing_projects;
  if (
    !row ||
    !project ||
    project.media?.kind !== key.contentType ||
    project.media.content_id !== key.contentId
  ) {
    throw new ApiError(404, "not_found", "Credit not found.");
  }
  return row;
}

/** The SQLSTATE of a failed database call, or "unknown". */
export function errorCode(error: unknown): string {
  return asString(readProperty(error, "code")) || "unknown";
}
