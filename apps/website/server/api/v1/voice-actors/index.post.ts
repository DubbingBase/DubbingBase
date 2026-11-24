import * as v from "valibot";
import { defineApiRoute } from "../../../utils/api-v1/define";
import { errorCode, notifyCreditChange } from "../../../utils/api-v1/credits";
import { ApiError } from "../../../utils/api-v1/errors";
import { useSupabaseAdmin } from "../../../utils/db/client";

const Name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100));

const Created = v.object({
  created: v.boolean(),
  replayed: v.boolean(),
  voice_actor_id: v.nullable(v.number()),
  duplicates: v.array(
    v.object({
      id: v.number(),
      firstname: v.string(),
      lastname: v.string(),
      tmdb_id: v.nullable(v.number()),
      wikidata_id: v.nullable(v.string()),
      date_of_birth: v.nullable(v.string()),
    }),
  ),
  exact: v.optional(v.boolean()),
});

export const route = defineApiRoute({
  summary: "Create a voice actor",
  tags: ["Voice actors"],
  scope: "voice-actors:create",
  idempotent: true,
  params: v.object({}),
  query: v.object({}),
  body: v.strictObject({
    firstname: Name,
    lastname: Name,
    /**
     * What tells this person apart from a homonym. A name that matches an existing actor
     * (ignoring case, accents and hyphens) is only created when one of these differs from that
     * actor's own, so give the ones you know from TMDB, Wikidata or a reliable source.
     */
    tmdb_id: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))), null),
    wikidata_id: v.optional(v.nullable(v.pipe(v.string(), v.regex(/^Q[1-9][0-9]*$/))), null),
    date_of_birth: v.optional(v.nullable(v.pipe(v.string(), v.isoDate())), null),
  }),
  response: v.object({
    path: v.string(),
    voice_actor_id: v.number(),
    /** True when this idempotency key already created the actor. */
    replayed: v.boolean(),
  }),
  handler: async ({ event, auth, body, idempotencyKey }) => {
    if (idempotencyKey === null)
      throw new ApiError(500, "internal_error", "Internal server error.");
    const { data, error } = await (event.context.supabaseAdmin || useSupabaseAdmin(event)).rpc(
      "api_create_voice_actor",
      {
        p_actor_id: auth.userId,
        p_request_id: idempotencyKey,
        p_firstname: body.firstname,
        p_lastname: body.lastname,
        p_tmdb_id: body.tmdb_id,
        p_wikidata_id: body.wikidata_id,
        p_date_of_birth: body.date_of_birth,
      },
    );
    if (error) {
      switch (errorCode(error)) {
        case "42501":
          throw new ApiError(403, "forbidden", "Not allowed to create voice actors.");
        case "22023":
          throw new ApiError(422, "invalid_request", "The voice actor fields are invalid.");
        case "23505":
          throw new ApiError(
            409,
            "conflict",
            "That voice actor already exists or the key was reused.",
          );
        default:
          console.error("api_create_voice_actor failed", errorCode(error));
          throw new ApiError(500, "internal_error", "Internal server error.");
      }
    }
    const result = v.parse(Created, data);
    if (result.voice_actor_id === null) {
      throw new ApiError(
        409,
        "duplicate_candidate",
        result.exact
          ? "A voice actor with exactly this name already exists."
          : "A voice actor with a matching name exists. If this is another person, resend with a tmdb_id, wikidata_id or date_of_birth that differs from theirs; if it is the same person, use the existing actor.",
        {},
        {
          duplicates: result.duplicates.map((actor) => ({
            ...actor,
            path: `/api/v1/voice-actors/${actor.id}`,
          })),
        },
      );
    }
    if (result.created) {
      notifyCreditChange(event, auth.userId, {
        entity: "voice actor",
        entityId: result.voice_actor_id,
        detail: `voice actor "${body.firstname} ${body.lastname}" created`,
        path: `/actor/${result.voice_actor_id}`,
      });
    }
    return {
      path: `/api/v1/voice-actors/${result.voice_actor_id}`,
      voice_actor_id: result.voice_actor_id,
      replayed: result.replayed,
    };
  },
});

export default route.handler;
