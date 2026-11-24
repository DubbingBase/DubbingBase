import { eqMediaRef, MEDIA_FILTER_EMBED } from "@app/shared-logic";
import * as v from "valibot";
import { defineApiRoute } from "../../../../../utils/api-v1/define";
import { ApiError } from "../../../../../utils/api-v1/errors";
import {
  mutateCredits,
  notifyCreditChange,
  requireMedia,
} from "../../../../../utils/api-v1/credits";
import {
  dubbingLanguage,
  mediaKey,
  mediaParams,
  apiMediaPath,
  sitePath,
  performanceSchema,
} from "../../../../../utils/api-v1/media";
import { useSupabaseAdmin } from "../../../../../utils/db/client";

const MAX_ITEMS = 50;

const BatchItem = v.strictObject({
  voice_actor_id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  character_name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
  language: dubbingLanguage,
  performance: v.optional(performanceSchema, "dialogues"),
  /** TMDB person id (movies, shows) or IGDB character id (games) of the on-screen cast member. */
  actor_id: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))), null),
  /** A character registered for this game (see the characters endpoint). Games only. */
  game_character_id: v.optional(v.nullable(v.pipe(v.string(), v.uuid(), v.toLowerCase())), null),
});

export const route = defineApiRoute({
  summary: "Add credits",
  tags: ["Credits"],
  scope: "credits:create",
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
        /** Dry run only: the credit a `create` item would add; null otherwise. */
        would_create: v.nullable(
          v.object({
            character_name: v.string(),
            voice_actor: v.object({ id: v.number(), firstname: v.string(), lastname: v.string() }),
            language: v.string(),
            performance: performanceSchema,
            actor_id: v.nullable(v.number()),
            game_character_id: v.nullable(v.string()),
          }),
        ),
      }),
    ),
  }),
  handler: async ({ event, auth, params, query, body }) => {
    const key = mediaKey(params.type, params.id);
    await requireMedia(event, key);
    const supabase = useSupabaseAdmin(event);

    // Everything is checked before the first write, so a bad item rejects the whole request.
    const existing: (number | null)[] = [];
    const actors: { id: number; firstname: string; lastname: string }[] = [];
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
      if (item.game_character_id !== null) {
        // Same rule as the write: the character must be registered for this game.
        const { data: character, error: characterError } = await eqMediaRef(
          supabase.from("game_characters").select(`id, ${MEDIA_FILTER_EMBED}`),
          key.contentType,
          key.contentId,
        )
          .eq("id", item.game_character_id)
          .maybeSingle();
        if (characterError) throw characterError;
        if (!character) {
          throw new ApiError(
            422,
            "invalid_reference",
            `credits.${index}: game character not found for this game.`,
          );
        }
      }
      const { data: actor, error: actorError } = await supabase
        .from("voice_actors")
        .select("id, firstname, lastname")
        .eq("id", item.voice_actor_id)
        .maybeSingle();
      if (actorError) throw actorError;
      if (!actor) {
        throw new ApiError(404, "not_found", `credits.${index}: voice actor not found.`);
      }
      actors.push({ id: actor.id, firstname: actor.firstname, lastname: actor.lastname });
      // The same role is one credit: same project, voice actor, cast id and character name.
      const { data: project, error: projectError } = await eqMediaRef(
        supabase.from("dubbing_projects").select(`id, ${MEDIA_FILTER_EMBED}`),
        key.contentType,
        key.contentId,
      )
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

    const base = apiMediaPath(key.segment, key.contentId);
    const dryRun = query.dry_run === "true";
    if (dryRun) {
      return {
        dry_run: true,
        data: body.credits.map((item, index) => {
          const match = existing[index] ?? null;
          if (match !== null) {
            return {
              action: "unchanged" as const,
              credit: `${base}/credits/${match}`,
              would_create: null,
            };
          }
          const actor = actors[index];
          if (!actor) throw new Error("Voice actor missing after validation");
          return {
            action: "create" as const,
            credit: null,
            would_create: {
              character_name: item.character_name,
              voice_actor: actor,
              language: item.language,
              performance: item.performance,
              actor_id: item.actor_id,
              game_character_id: item.game_character_id,
            },
          };
        }),
      };
    }

    // One transaction: a rejected item rolls the whole batch back.
    const written = await mutateCredits(
      event,
      auth.userId,
      "create",
      body.credits.map((item) => ({
        voice_actor_id: item.voice_actor_id,
        content_id: key.contentId,
        content_type: key.contentType,
        language: item.language,
        actor_person_id: item.actor_id,
        game_character_id: item.game_character_id,
        character_name: item.character_name,
        performance: item.performance,
      })),
      (index) => `credits.${index}`,
    );
    const results = written.map((credit) => ({
      action: credit.created ? ("create" as const) : ("unchanged" as const),
      credit: `${base}/credits/${credit.work_id}`,
      would_create: null,
    }));
    const created = written.filter((credit) => credit.created).length;
    if (created > 0) {
      notifyCreditChange(event, auth.userId, {
        entityId: `${key.contentType}/${key.contentId}`,
        detail: `${created} cast credit${created === 1 ? "" : "s"} added`,
        path: sitePath(key.segment, key.contentId),
      });
    }
    return { dry_run: false, data: results };
  },
});

export default route.handler;
