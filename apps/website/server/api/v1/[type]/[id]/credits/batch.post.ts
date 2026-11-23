import * as v from "valibot";
import { defineApiRoute } from "../../../../../utils/api-v1/define";
import { ApiError } from "../../../../../utils/api-v1/errors";
import { errorCode, isStatus, requireMedia } from "../../../../../utils/api-v1/credits";
import {
  deriveRequestId,
  dubbingLanguage,
  mediaKey,
  mediaParams,
  apiMediaPath,
  performanceSchema,
} from "../../../../../utils/api-v1/media";
import { useSupabaseAdmin } from "../../../../../utils/db/client";
import { validateMediaReference } from "../../../../../utils/media-reference";

const MAX_ITEMS = 50;

const BatchItem = v.strictObject({
  voice_actor_id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  character_name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
  language: dubbingLanguage,
  performance: v.optional(performanceSchema, "dialogues"),
  /** TMDB person id (movies, shows) or IGDB character id (games) of the on-screen cast member. */
  actor_id: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))), null),
  /** A character registered for this game (see the characters endpoint). Games only. */
  game_character_id: v.optional(v.nullable(v.pipe(v.string(), v.uuid())), null),
});

export const route = defineApiRoute({
  summary: "Add credits",
  tags: ["Credits"],
  scope: "credits:write",
  idempotent: true,
  params: mediaParams,
  query: v.object({
    /** `true` validates everything and reports what would happen without writing. */
    dry_run: v.optional(v.picklist(["true", "false"]), "false"),
  }),
  body: v.strictObject({
    credits: v.pipe(v.array(BatchItem), v.minLength(1), v.maxLength(MAX_ITEMS)),
  }),
  response: v.object({
    dry_run: v.boolean(),
    data: v.array(
      v.object({
        /** `create` adds a credit; `unchanged` means that voice actor already holds that role. */
        action: v.picklist(["create", "unchanged"]),
        credit: v.nullable(v.string()),
      }),
    ),
  }),
  handler: async ({ event, auth, params, query, body, idempotencyKey }) => {
    if (idempotencyKey === null)
      throw new ApiError(500, "internal_error", "Internal server error.");
    const key = mediaKey(params.type, params.id);
    await requireMedia(event, key);
    const supabase = useSupabaseAdmin(event);

    // Everything is checked before the first write, so a bad item rejects the whole request.
    const existing: (number | null)[] = [];
    for (const [index, item] of body.credits.entries()) {
      if (item.game_character_id !== null && key.contentType !== "video_game") {
        throw new ApiError(400, "invalid_request", `credits.${index}: only games have characters.`);
      }
      if (
        item.actor_id !== null &&
        key.contentType !== "movie" &&
        key.contentType !== "tv" &&
        key.contentType !== "video_game"
      ) {
        throw new ApiError(400, "invalid_request", `credits.${index}: this media has no cast ids.`);
      }
      if (item.game_character_id !== null && item.actor_id !== null) {
        throw new ApiError(
          400,
          "invalid_request",
          `credits.${index}: use either actor_id or game_character_id.`,
        );
      }
      const { data: actor, error: actorError } = await supabase
        .from("voice_actors")
        .select("id")
        .eq("id", item.voice_actor_id)
        .maybeSingle();
      if (actorError) throw actorError;
      if (!actor) {
        throw new ApiError(404, "not_found", `credits.${index}: voice actor not found.`);
      }
      try {
        await validateMediaReference(event, {
          media_type: key.contentType,
          media_id: key.contentId,
          actor_id: item.actor_id,
          game_character_id: item.game_character_id,
        });
      } catch (cause) {
        if (isStatus(cause, 422)) {
          throw new ApiError(
            422,
            "invalid_reference",
            `credits.${index}: the media, actor or character is not known to its provider.`,
          );
        }
        throw new ApiError(503, "provider_unavailable", "The media provider could not be reached.");
      }

      // The same role is one credit: same project, voice actor, cast id and character name.
      const { data: project, error: projectError } = await supabase
        .from("dubbing_projects")
        .select("id")
        .eq("content_type", key.contentType)
        .eq("content_id", key.contentId)
        .eq("language", item.language)
        .maybeSingle();
      if (projectError) throw projectError;
      let match: number | null = null;
      if (project) {
        const { data: works, error: worksError } = await supabase
          .from("work")
          .select("id, character_name, actor_id, game_character_id")
          .eq("dubbing_project_id", project.id)
          .eq("voice_actor_id", item.voice_actor_id);
        if (worksError) throw worksError;
        const wanted = item.character_name.toLowerCase();
        match =
          (works ?? []).find(
            (work) =>
              work.actor_id === item.actor_id &&
              work.game_character_id === item.game_character_id &&
              work.character_name?.trim().toLowerCase() === wanted,
          )?.id ?? null;
      }
      existing.push(match);
    }

    // The generated argument types make nullable parameters non-null, which the functions accept.
    const rpcClient = event.context.supabaseAdmin || useSupabaseAdmin(event);
    const base = apiMediaPath(key.segment, key.contentId);
    const dryRun = query.dry_run === "true";
    const results: { action: "create" | "unchanged"; credit: string | null }[] = [];
    for (const [index, item] of body.credits.entries()) {
      const match = existing[index] ?? null;
      if (dryRun) {
        results.push(
          match === null
            ? { action: "create", credit: null }
            : { action: "unchanged", credit: `${base}/credits/${match}` },
        );
        continue;
      }
      // Each item is written by an idempotent database function keyed by a request id derived
      // from the key and position, so retrying a request that stopped midway with the same
      // Idempotency-Key finishes it without duplicating anything.
      const { data, error } = await rpcClient.rpc("create_voice_actor_work_link", {
        p_user_id: auth.userId,
        p_request_id: await deriveRequestId(idempotencyKey, index),
        p_voice_actor_id: item.voice_actor_id,
        p_content_id: key.contentId,
        p_content_type: key.contentType,
        p_language: item.language,
        p_actor_person_id: item.actor_id,
        p_game_character_id: item.game_character_id,
        p_character_name: item.character_name,
        p_performance: item.performance,
      });
      if (error) {
        const progress = `${index} of ${body.credits.length} credits were written; retry with the same Idempotency-Key.`;
        switch (errorCode(error)) {
          case "42501":
          case "28000":
            throw new ApiError(403, "forbidden", "Not allowed to add credits.");
          case "55000":
          case "23505":
          case "40001":
          case "40P01":
          case "PT409":
            throw new ApiError(409, "conflict", `Conflicting change. ${progress}`);
          case "22023":
          case "23503":
          case "22P02":
          case "22003":
            throw new ApiError(422, "invalid_reference", `credits.${index} was rejected.`);
          default:
            console.error("create_voice_actor_work_link failed", errorCode(error));
            throw new ApiError(500, "internal_error", "Internal server error.");
        }
      }
      const [created] = v.parse(
        v.pipe(v.array(v.object({ work_id: v.number() })), v.length(1)),
        data,
      );
      results.push({
        action: match === null ? "create" : "unchanged",
        credit: `${base}/credits/${created?.work_id}`,
      });
    }
    return { dry_run: dryRun, data: results };
  },
});

export default route.handler;
