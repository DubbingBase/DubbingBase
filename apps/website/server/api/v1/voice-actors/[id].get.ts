import * as v from "valibot";
import { defineApiRoute } from "../../../utils/api-v1/define";
import { ApiError } from "../../../utils/api-v1/errors";
import { VoiceActor, VOICE_ACTOR_COLUMNS, positiveId } from "../../../utils/api-v1/voice-actors";
import { useSupabaseAdmin } from "../../../utils/db/client";

export const route = defineApiRoute({
  summary: "Get a voice actor",
  tags: ["Voice actors"],
  scope: "voice-actors:read",
  params: v.object({ id: positiveId }),
  query: v.object({}),
  response: VoiceActor,
  handler: async ({ event, params }) => {
    const { data, error } = await useSupabaseAdmin(event)
      .from("voice_actors")
      .select(VOICE_ACTOR_COLUMNS)
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "not_found", "Voice actor not found.");
    return v.parse(VoiceActor, data);
  },
});

export default route.handler;
