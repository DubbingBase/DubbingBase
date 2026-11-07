import { resolveUser } from "../utils/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRecord, readProperty, type Database } from "@app/shared-logic";
import { asString } from "../utils/narrow";
import { useSupabaseAdmin } from "../utils/db/client";

/**
 * Reads a name from the embedded `voice_actors` row. PostgREST returns a single object for this
 * many-to-one relation, but an array is tolerated too. `Array.isArray` narrows to `any[]`, so the
 * embed is read as `unknown`.
 */
function embeddedName(embedded: unknown, key: "firstname" | "lastname"): string | undefined {
  const row: unknown = Array.isArray(embedded) ? embedded[0] : embedded;
  return asString(readProperty(row, key));
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export default defineEventHandler(async (event) => {
  const user = await resolveUser(event);
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const userId = user.id;

  const body: unknown = await readBody(event);
  const action = isRecord(body) ? body.action : undefined;

  if (!action) {
    throw createError({
      statusCode: 400,
      message: "Missing 'action' in payload",
    });
  }

  const supabaseAdmin: SupabaseClient<Database> = event.context.supabaseAdmin || useSupabaseAdmin();

  if (action === "list") {
    const { data, error } = await supabaseAdmin
      .from("voice_actor_subscriptions")
      .select("voice_actor_id, voice_actors(firstname, lastname)")
      .eq("user_id", userId);

    if (error) {
      console.error("[manage-subscription] DB Error during list:", error);
      throw error;
    }

    const subscriptions = data.map((sub) => ({
      voice_actor_id: sub.voice_actor_id,
      firstname: embeddedName(sub.voice_actors, "firstname"),
      lastname: embeddedName(sub.voice_actors, "lastname"),
    }));

    return { subscriptions };
  } else if (action === "subscribe" || action === "unsubscribe") {
    const voiceActorId = isRecord(body) ? body.voice_actor_id : undefined;

    if (!voiceActorId) {
      throw createError({
        statusCode: 400,
        message: "Missing 'voice_actor_id' for subscribe/unsubscribe",
      });
    }

    if (!isPositiveId(voiceActorId)) {
      throw createError({
        statusCode: 400,
        message: "Invalid 'voice_actor_id' for subscribe/unsubscribe",
      });
    }

    if (action === "subscribe") {
      const { error } = await supabaseAdmin
        .from("voice_actor_subscriptions")
        .insert({ user_id: userId, voice_actor_id: voiceActorId });

      if (error && error.code !== "23505") {
        console.error("[manage-subscription] DB Error during subscribe:", error);
        throw error;
      }
    } else if (action === "unsubscribe") {
      const { error } = await supabaseAdmin
        .from("voice_actor_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("voice_actor_id", voiceActorId);

      if (error) {
        console.error("[manage-subscription] DB Error during unsubscribe:", error);
        throw error;
      }
    }

    return { ok: true };
  } else {
    throw createError({ statusCode: 400, message: "Invalid action" });
  }
});
