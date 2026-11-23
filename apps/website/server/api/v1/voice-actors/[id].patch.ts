import * as v from "valibot";
import { defineApiRoute } from "../../../utils/api-v1/define";
import { ApiError } from "../../../utils/api-v1/errors";
import { Json, VoiceActor, voiceActorId } from "../../../utils/api-v1/voice-actors";
import { useSupabaseAdmin } from "../../../utils/db/client";

// Picture and workflow `status` changes are deliberately not exposed in v1.
const VoiceActorUpdates = v.pipe(
  v.partial(
    v.strictObject({
      firstname: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
      lastname: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
      bio: v.nullable(v.pipe(v.string(), v.maxLength(10_000))),
      nationality: v.nullable(v.pipe(v.string(), v.maxLength(200))),
      date_of_birth: v.nullable(v.pipe(v.string(), v.isoDate())),
      awards: v.nullable(v.pipe(v.string(), v.maxLength(5_000))),
      years_active: v.nullable(v.pipe(v.string(), v.maxLength(200))),
      social_media_links: v.nullable(Json),
      tmdb_id: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
      wikidata_id: v.nullable(v.pipe(v.string(), v.regex(/^Q\d+$/))),
    }),
  ),
  v.check((updates) => Object.keys(updates).length > 0, "at least one field is required"),
);

export const route = defineApiRoute({
  summary: "Update a voice actor",
  tags: ["Voice actors"],
  scope: "voice-actors:write",
  idempotent: true,
  params: v.object({ id: voiceActorId }),
  query: v.object({}),
  body: v.strictObject({
    updates: VoiceActorUpdates,
  }),
  response: v.object({
    /** False when the update matched the stored values and nothing was written. */
    changed: v.boolean(),
    record: VoiceActor,
  }),
  handler: async ({ event, auth, params, body, idempotencyKey }) => {
    if (idempotencyKey === null)
      throw new ApiError(500, "internal_error", "Internal server error.");
    const supabase = useSupabaseAdmin(event);

    // The update is atomic and last-write-wins. The database function wants the row's current
    // version, so it is read here and handed straight back; a write that lands in between makes
    // the function answer with a retryable 409.
    const { data: existing, error: readError } = await supabase
      .from("voice_actors")
      .select("updated_at")
      .eq("id", params.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing?.updated_at) throw new ApiError(404, "not_found", "Voice actor not found.");

    const { data, error } = await supabase.rpc("controlled_update_voice_actor", {
      p_actor_id: auth.userId,
      p_voice_actor_id: params.id,
      p_payload: body.updates,
      p_expected_updated_at: existing.updated_at,
      p_request_id: idempotencyKey,
    });
    if (error) {
      switch (error.code) {
        case "42501":
          throw new ApiError(403, "forbidden", "Not allowed to update this voice actor.");
        case "22023":
        case "22007":
        case "22008":
          throw new ApiError(400, "invalid_request", "The update is invalid.");
        case "P0002":
          throw new ApiError(404, "not_found", "Voice actor not found.");
        case "PT409":
        case "23505":
          throw new ApiError(
            409,
            "conflict",
            "The voice actor was changed at the same time; retry.",
          );
        default:
          console.error("controlled_update_voice_actor failed", error.code ?? "unknown");
          throw new ApiError(500, "internal_error", "Internal server error.");
      }
    }
    const result = v.parse(v.object({ changed: v.boolean(), record: VoiceActor }), data);
    return { changed: result.changed, record: result.record };
  },
});

export default route.handler;
