import type { H3Event } from "h3";
import { MEDIA_EMBED, readProperty } from "@app/shared-logic";
import { asString } from "../narrow";
import type { Json } from "@app/supabase/types";
import * as v from "valibot";
import { useSupabaseAdmin } from "../db/client";
import { notifyContributionEdit } from "../notifications/contribution";
import { ApiError } from "./errors";
import { apiMediaPath, performanceSchema, type MediaKey } from "./media";

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
 * Confirms the media is known to DubbingBase. The API never calls the media providers, so
 * media nobody has opened on the website yet is a 404.
 */
export async function requireMedia(event: H3Event, key: MediaKey): Promise<void> {
  const { data, error } = await useSupabaseAdmin(event)
    .from("media")
    .select("id")
    .eq("kind", key.contentType)
    .eq("content_id", key.contentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "not_found", "Media not found.");
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

const MutationResults = v.array(
  v.object({
    work_id: v.number(),
    created: v.boolean(),
    /** The credit row as the transaction wrote it. */
    after: v.nullable(v.record(v.string(), v.unknown())),
  }),
);

type CreditOperation = "create" | "update";

/**
 * Applies credit changes as the token's owner through `api_mutate_credits`: one transaction,
 * so either every item is written or none is. Database failures become API errors; `label`
 * names the item that was rejected.
 */
export async function mutateCredits(
  event: H3Event,
  userId: string,
  operation: CreditOperation,
  items: Json[],
  label: (index: number) => string,
): Promise<v.InferOutput<typeof MutationResults>> {
  // The generated argument types make nullable parameters non-null, which the functions accept.
  const client = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data, error } = await client.rpc("api_mutate_credits", {
    p_user_id: userId,
    p_operation: operation,
    p_items: items,
  });
  if (error) {
    const index = Number.parseInt(error.hint ?? "", 10);
    const where = Number.isInteger(index) ? label(index) : "A credit";
    switch (errorCode(error)) {
      case "42501":
      case "28000":
        throw new ApiError(403, "forbidden", `${where}: not allowed.`);
      case "P0002":
        throw new ApiError(404, "not_found", `${where}: credit not found.`);
      case "55000":
      case "23505":
      case "40001":
      case "40P01":
      case "PT409":
        throw new ApiError(409, "conflict", `${where}: conflicting change; nothing was written.`);
      case "22023":
      case "23503":
      case "22P02":
      case "22003":
        throw new ApiError(422, "invalid_reference", `${where} was rejected; nothing was written.`);
      default:
        console.error("api_mutate_credits failed", errorCode(error));
        throw new ApiError(500, "internal_error", "Internal server error.");
    }
  }
  return v.parse(MutationResults, data);
}

/** Reports an API credit change to the admin channel like a website contribution, once per request. */
export function notifyCreditChange(
  event: H3Event,
  userId: string,
  edit: { entityId: string | number; detail: string; path: string },
): void {
  notifyContributionEdit(
    event,
    { id: userId, app_metadata: {} },
    { entity: "media", via: "api", ...edit },
  );
}
