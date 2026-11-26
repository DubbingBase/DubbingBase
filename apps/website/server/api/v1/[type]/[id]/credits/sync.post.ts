import { eqMediaRef, MEDIA_FILTER_EMBED } from "@app/shared-logic";
import type { Json } from "@app/supabase/types";
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
import { shortText } from "../../../../../utils/notifications/discord";

const MAX_ITEMS = 50;

type Performance = v.InferOutput<typeof performanceSchema>;

/** What differs between a credit that exists and the item that describes it; null when nothing. */
function diffCredit(
  item: { performance?: Performance; highlight?: boolean },
  current: { performance: string | null; highlight: boolean | null },
) {
  const changes: {
    performance?: { from: string | null; to: Performance };
    highlight?: { from: boolean; to: boolean };
  } = {};
  if (item.performance !== undefined && item.performance !== current.performance) {
    changes.performance = { from: current.performance, to: item.performance };
  }
  const highlight = current.highlight ?? false;
  if (item.highlight !== undefined && item.highlight !== highlight) {
    changes.highlight = { from: highlight, to: item.highlight };
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

const SyncItem = v.strictObject({
  voice_actor_id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  character_name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
  language: dubbingLanguage,
  /** Defaults to `dialogues` on a new credit; omit it to leave an existing credit's alone. */
  performance: v.optional(performanceSchema),
  /** TMDB person id (movies, shows) or IGDB character id (games) of the on-screen cast member. */
  actor_id: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))), null),
  /** A character registered for this game (see the characters endpoint). Games only. */
  game_character_id: v.optional(v.nullable(v.pipe(v.string(), v.uuid(), v.toLowerCase())), null),
  /** Main character flag. Defaults to false on a new credit; omit it to leave an existing credit's alone. */
  highlight: v.optional(v.boolean()),
});

export const route = defineApiRoute({
  summary: "Sync credits",
  tags: ["Credits"],
  // Creates what is missing and updates what differs, so both scopes are needed.
  scope: ["credits:create", "credits:update"],
  notFound: "The media or a referenced voice actor has no local DubbingBase record.",
  params: mediaParams,
  query: v.object({
    /** `true` validates everything and reports what would happen without writing. */
    dry_run: v.optional(v.picklist(["true", "false"]), "false"),
  }),
  body: v.strictObject({
    credits: v.pipe(v.array(SyncItem), v.minLength(1), v.maxLength(MAX_ITEMS)),
  }),
  response: v.object({
    dry_run: v.boolean(),
    data: v.array(
      v.object({
        /**
         * `create` adds a credit; `update` changes `performance` or `highlight` of the credit that
         * already holds that role; `unchanged` means it already matches. Credits not listed in the
         * request are never touched or deleted.
         */
        action: v.picklist(["create", "update", "unchanged"]),
        credit: v.nullable(v.string()),
        /**
         * Set when `game_character_id` was omitted and the credit that matched by name is linked to
         * a game character: that character's id. Null otherwise.
         */
        linked_game_character_id: v.nullable(v.string()),
        /** What an `update` item changes (previewed on a dry run, applied otherwise); null otherwise. */
        changes: v.nullable(
          v.object({
            performance: v.optional(
              v.object({ from: v.nullable(v.string()), to: performanceSchema }),
            ),
            highlight: v.optional(v.object({ from: v.boolean(), to: v.boolean() })),
          }),
        ),
        /** Dry run only: the credit a `create` item would add; null otherwise. */
        would_create: v.nullable(
          v.object({
            character_name: v.string(),
            voice_actor: v.object({ id: v.number(), firstname: v.string(), lastname: v.string() }),
            language: v.string(),
            performance: performanceSchema,
            actor_id: v.nullable(v.number()),
            game_character_id: v.nullable(v.string()),
            highlight: v.boolean(),
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
    type Match = {
      id: number;
      linked: string | null;
      highlight: boolean | null;
      performance: string | null;
      updatedAt: string;
    };
    const existing: (Match | null)[] = [];
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
      let match: Match | null = null;
      if (project) {
        const { data: works, error: worksError } = await supabase
          .from("work")
          .select(
            "id, character_name, actor_id, game_character_id, highlight, performance, updated_at",
          )
          .eq("dubbing_project_id", project.id)
          .eq("voice_actor_id", item.voice_actor_id);
        if (worksError) throw worksError;
        const wanted = item.character_name.toLowerCase();
        const sameRole = (works ?? []).filter(
          (work) =>
            work.actor_id === item.actor_id && work.character_name?.trim().toLowerCase() === wanted,
        );
        const exact = sameRole.find((work) => work.game_character_id === item.game_character_id);
        if (exact) {
          match = {
            id: exact.id,
            linked: null,
            highlight: exact.highlight,
            performance: exact.performance,
            updatedAt: exact.updated_at,
          };
        } else if (item.game_character_id === null && sameRole.length > 0) {
          // The credit exists but is linked to a character this item left out: a retry that
          // drops the id must not add a second credit for the same role.
          if (sameRole.length > 1) {
            throw new ApiError(
              409,
              "ambiguous_credit",
              `credits.${index}: several credits with this name are linked to different game characters; send game_character_id.`,
            );
          }
          const [only] = sameRole;
          if (only) {
            match = {
              id: only.id,
              linked: only.game_character_id,
              highlight: only.highlight,
              performance: only.performance,
              updatedAt: only.updated_at,
            };
          }
        }
        if (match === null) {
          // A credit without a character name cannot match by name, so it would end up next to
          // the new one. Complete it in place with PATCH instead of adding a second credit.
          const nameless = (works ?? []).filter(
            (work) =>
              (work.character_name?.trim() ?? "") === "" &&
              work.actor_id === item.actor_id &&
              // Like the named-role match: an omitted link is compatible with a linked credit.
              (item.game_character_id === null ||
                work.game_character_id === null ||
                work.game_character_id === item.game_character_id),
          );
          if (nameless.length > 0) {
            throw new ApiError(
              409,
              "nameless_credit_exists",
              `credits.${index}: this voice actor already has a credit without a character name (${nameless.map((work) => `${apiMediaPath(key.segment, key.contentId)}/credits/${work.id}`).join(", ")}); complete it with PATCH instead of adding a new credit.`,
            );
          }
        }
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
            const change = diffCredit(item, match);
            return {
              action: change === null ? ("unchanged" as const) : ("update" as const),
              credit: `${base}/credits/${match.id}`,
              linked_game_character_id: match.linked,
              changes: change,
              would_create: null,
            };
          }
          const actor = actors[index];
          if (!actor) throw new Error("Voice actor missing after validation");
          return {
            action: "create" as const,
            credit: null,
            linked_game_character_id: null,
            changes: null,
            would_create: {
              character_name: item.character_name,
              voice_actor: actor,
              language: item.language,
              performance: item.performance ?? "dialogues",
              actor_id: item.actor_id,
              game_character_id: item.game_character_id,
              highlight: item.highlight ?? false,
            },
          };
        }),
      };
    }

    // One call, one transaction: creates and in-place updates are applied together, so a
    // rejected item rolls back the whole request. Matched credits that already agree are not sent.
    const toSend = body.credits.flatMap<{ index: number; payload: Json }>((item, index) => {
      const match = existing[index];
      if (!match) {
        return [
          {
            index,
            payload: {
              voice_actor_id: item.voice_actor_id,
              content_id: key.contentId,
              content_type: key.contentType,
              language: item.language,
              actor_person_id: item.actor_id,
              game_character_id: item.game_character_id,
              character_name: item.character_name,
              performance: item.performance ?? "dialogues",
              highlight: item.highlight ?? false,
            },
          },
        ];
      }
      const change = diffCredit(item, match);
      if (!change) return [];
      return [
        {
          index,
          payload: {
            work_id: match.id,
            expected_updated_at: match.updatedAt,
            ...(change.performance ? { performance: change.performance.to } : {}),
            ...(change.highlight ? { highlight: change.highlight.to } : {}),
          },
        },
      ];
    });
    const written = toSend.length
      ? await mutateCredits(
          event,
          auth.userId,
          "sync",
          toSend.map(({ payload }) => payload),
          (position) => `credits.${toSend[position]?.index ?? position}`,
        )
      : [];
    const writtenByIndex = new Map(toSend.map(({ index }, position) => [index, written[position]]));
    const results = body.credits.map((_, index) => {
      const name = existing[index];
      if (name) {
        const change = diffCredit(body.credits[index] ?? {}, name);
        return {
          action: change === null ? ("unchanged" as const) : ("update" as const),
          credit: `${base}/credits/${name.id}`,
          linked_game_character_id: name.linked,
          changes: change,
          would_create: null,
        };
      }
      const credit = writtenByIndex.get(index);
      if (!credit) throw new Error("Credit missing after write");
      return {
        action: credit.created ? ("create" as const) : ("unchanged" as const),
        credit: `${base}/credits/${credit.work_id}`,
        linked_game_character_id: null,
        changes: null,
        would_create: null,
      };
    });
    const created = written.filter((credit) => credit.created).length;
    if (created > 0) {
      notifyCreditChange(event, auth.userId, {
        entityId: `${key.contentType}/${key.contentId}`,
        detail: `${created} cast credit${created === 1 ? "" : "s"} added`,
        path: sitePath(key.segment, key.contentId),
        subject: `${key.contentType} #${key.contentId}`,
        tag: "API · credits added",
        // One line per new credit: who voices whom, so the admin can judge it without opening the page.
        fields: written
          .flatMap((credit, position) => {
            const entry = toSend[position];
            const item = entry ? body.credits[entry.index] : undefined;
            const actor = entry ? actors[entry.index] : undefined;
            if (!credit.created || !item || !actor) return [];
            return [
              {
                name: shortText(`${actor.firstname} ${actor.lastname}`.trim(), 80),
                value: shortText(
                  `${item.character_name} · ${item.language}${item.performance ? ` · ${item.performance}` : ""}`,
                  200,
                ),
              },
            ];
          })
          .slice(0, 10),
      });
    }
    return { dry_run: false, data: results };
  },
});

export default route.handler;
