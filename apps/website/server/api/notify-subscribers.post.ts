import { buildTmdbImageUrl } from "../utils/urls/tmdb";
import { sendOneSignalNotification } from "../utils/notifications/onesignal";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const record = body.record;
    const voiceActorId = record?.voice_actor_id;
    const dubbingProjectId = record?.dubbing_project_id;

    if (!voiceActorId || !dubbingProjectId) {
      console.error("[Notify] Invalid payload", body);
      throw createError({
        statusCode: 400,
        message:
          "Invalid payload: missing record.voice_actor_id or record.dubbing_project_id",
      });
    }

    const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

    const { data: voiceActor, error: vaError } = await supabaseAdmin
      .from("voice_actors")
      .select("firstname, lastname")
      .eq("id", voiceActorId)
      .single();

    if (vaError || !voiceActor) {
      throw new Error(`Voice actor ${voiceActorId} not found`);
    }

    const { data: project, error: pError } = await supabaseAdmin
      .from("dubbing_projects")
      .select("content_id, content_type")
      .eq("id", dubbingProjectId)
      .single();

    if (pError || !project) {
      throw new Error(`Dubbing project ${dubbingProjectId} not found`);
    }

    const config = useRuntimeConfig();
    let mediaTitle = "a new project";
    let imageUrl: string | undefined = undefined;
    try {
      const tmdbType = project.content_type === "movie" ? "movie" : "tv";
      const tmdbUrl = `https://api.themoviedb.org/3/${tmdbType}/${project.content_id}?language=fr-FR`;
      const tmdbRes = await fetch(tmdbUrl, {
        headers: {
          Authorization: `Bearer ${config.tmdbApiKey}`,
          Accept: "application/json",
        },
      });
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        mediaTitle = tmdbData.title || tmdbData.name || mediaTitle;
        if (tmdbData.poster_path) {
          imageUrl = buildTmdbImageUrl(tmdbData.poster_path) || undefined;
        }
      }
    } catch (tmdbErr) {
      console.warn("[Notify] Failed to fetch TMDB title:", tmdbErr);
    }

    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("voice_actor_subscriptions")
      .select("user_id")
      .eq("voice_actor_id", voiceActorId);

    if (subError) {
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(
        `[Notify] No subscribers found for voice actor ${voiceActorId}`,
      );
      return { ok: true, notified: 0 };
    }

    const targetUserIds = subscriptions.map((sub: any) => sub.user_id);

    const voiceActorName =
      `${voiceActor.firstname} ${voiceActor.lastname}`.trim();

    console.log(
      `[Notify] Sending notification to ${targetUserIds.length} users for ${voiceActorName} in ${mediaTitle}`,
    );

    await sendOneSignalNotification(
      `New Role for ${voiceActorName}`,
      `They have just been added to the cast of ${mediaTitle}!`,
      {
        targetExternalIds: targetUserIds,
        url: `/voice-actor/${voiceActorId}`,
        imageUrl,
      },
    );

    console.log(`[Notify] Notification sent for voice actor ${voiceActorId}`);

    return { ok: true, notified: targetUserIds.length };
  } catch (err) {
    console.error("[Notify] Error processing notification webhook:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw createError({ statusCode: 500, message: errorMessage });
  }
});
