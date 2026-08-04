import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { sendOneSignalNotification } from "../_shared/onesignal.ts";

export default {
  fetch: withSupabase<Database>(
    { auth: "secret" }, // Only invoked by Database Webhooks
    async (req, ctx) => {
      try {
        const body = await req.json();
        
        const record = body.record;
        const voiceActorId = record?.voice_actor_id;
        const dubbingProjectId = record?.dubbing_project_id;
        
        if (!voiceActorId || !dubbingProjectId) {
          console.error("[Notify] Invalid payload", body);
          return Response.json({ ok: false, error: "Invalid payload: missing record.voice_actor_id or record.dubbing_project_id" }, { status: 400 });
        }

        // 1. Fetch Voice Actor name
        const { data: voiceActor, error: vaError } = await ctx.supabaseAdmin
          .from("voice_actors")
          .select("firstname, lastname")
          .eq("id", voiceActorId)
          .single();

        if (vaError || !voiceActor) {
          throw new Error(`Voice actor ${voiceActorId} not found`);
        }

        // 2. Fetch Dubbing Project info to get the title from TMDB
        const { data: project, error: pError } = await ctx.supabaseAdmin
          .from("dubbing_projects")
          .select("content_id, content_type")
          .eq("id", dubbingProjectId)
          .single();

        if (pError || !project) {
          throw new Error(`Dubbing project ${dubbingProjectId} not found`);
        }

        // 3. Fetch title from TMDB
        let mediaTitle = "a new project";
        try {
          const tmdbType = project.content_type === "movie" ? "movie" : "tv";
          const tmdbUrl = `https://api.themoviedb.org/3/${tmdbType}/${project.content_id}?language=fr-FR`;
          const tmdbRes = await fetch(tmdbUrl, {
            headers: {
              Authorization: `Bearer ${Deno.env.get("TMDB_API_KEY")}`,
              Accept: "application/json"
            }
          });
          if (tmdbRes.ok) {
            const tmdbData = await tmdbRes.json();
            mediaTitle = tmdbData.title || tmdbData.name || mediaTitle;
          }
        } catch (tmdbErr) {
          console.warn("[Notify] Failed to fetch TMDB title:", tmdbErr);
        }

        // 3. Fetch Subscribers
        const { data: subscriptions, error: subError } = await ctx.supabaseAdmin
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
          return Response.json({ ok: true, notified: 0 });
        }

        const targetUserIds = subscriptions.map((sub) => sub.user_id);

        const voiceActorName = `${voiceActor.firstname} ${voiceActor.lastname}`.trim();

        console.log(
          `[Notify] Sending notification to ${targetUserIds.length} users for ${voiceActorName} in ${mediaTitle}`,
        );

        await sendOneSignalNotification(
          `New Role for ${voiceActorName}`,
          `They have just been added to the cast of ${mediaTitle}!`,
          {
            targetExternalIds: targetUserIds,
            url: `/voice-actor/${voiceActorId}`,
          },
        );

        return Response.json({ ok: true, notified: targetUserIds.length });
      } catch (err) {
        console.error("[Notify] Error processing notification webhook:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        return Response.json({ ok: false, error: errorMessage }, {
          status: 500,
        });
      }
    },
  ),
};
