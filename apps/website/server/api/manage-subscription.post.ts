import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const userId = user.id;

  const body = await readBody(event);
  const action = body.action;

  if (!action) {
    throw createError({
      statusCode: 400,
      message: "Missing 'action' in payload",
    });
  }

  const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

  if (action === "list") {
    const { data, error } = await supabaseAdmin
      .from("voice_actor_subscriptions")
      .select("voice_actor_id, voice_actors(firstname, lastname)")
      .eq("user_id", userId);

    if (error) {
      console.error("[manage-subscription] DB Error during list:", error);
      throw error;
    }

    const subscriptions = data.map((sub: any) => ({
      voice_actor_id: sub.voice_actor_id,
      firstname: Array.isArray(sub.voice_actors)
        ? sub.voice_actors[0]?.firstname
        : sub.voice_actors?.firstname,
      lastname: Array.isArray(sub.voice_actors)
        ? sub.voice_actors[0]?.lastname
        : sub.voice_actors?.lastname,
    }));

    return { subscriptions };
  } else if (action === "subscribe" || action === "unsubscribe") {
    const voiceActorId = body.voice_actor_id;

    if (!voiceActorId) {
      throw createError({
        statusCode: 400,
        message: "Missing 'voice_actor_id' for subscribe/unsubscribe",
      });
    }

    if (action === "subscribe") {
      const { error } = await supabaseAdmin
        .from("voice_actor_subscriptions")
        .insert({ user_id: userId, voice_actor_id: voiceActorId });

      if (error && error.code !== "23505") {
        console.error(
          "[manage-subscription] DB Error during subscribe:",
          error,
        );
        throw error;
      }
    } else if (action === "unsubscribe") {
      const { error } = await supabaseAdmin
        .from("voice_actor_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("voice_actor_id", voiceActorId);

      if (error) {
        console.error(
          "[manage-subscription] DB Error during unsubscribe:",
          error,
        );
        throw error;
      }
    }

    return { ok: true };
  } else {
    throw createError({ statusCode: 400, message: "Invalid action" });
  }
});
