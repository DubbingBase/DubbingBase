import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      console.log("[manage-subscription] Incoming request received.");
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const userId = user.id;

      console.log(`[manage-subscription] Authenticated user: ${userId}`);

      const body = await req.json();
      console.log("[manage-subscription] Request body:", body);
      
      const action = body.action;

      if (!action) {
        console.error("[manage-subscription] 400 Bad Request. Missing action.");
        return Response.json(
          { error: "Missing 'action' in payload" },
          { status: 400 },
        );
      }



      if (action === "list") {
        console.log(`[manage-subscription] Fetching subscriptions for user: ${userId}`);
        const { data, error } = await ctx.supabase
          .from("voice_actor_subscriptions")
          .select("voice_actor_id, voice_actors(firstname, lastname)")
          .eq("user_id", userId);

        if (error) {
          console.error("[manage-subscription] DB Error during list:", error);
          throw error;
        }

        const subscriptions = data.map((sub: any) => ({
          voice_actor_id: sub.voice_actor_id,
          firstname: Array.isArray(sub.voice_actors) ? sub.voice_actors[0]?.firstname : sub.voice_actors?.firstname,
          lastname: Array.isArray(sub.voice_actors) ? sub.voice_actors[0]?.lastname : sub.voice_actors?.lastname,
        }));
        
        console.log(`[manage-subscription] Returning ${subscriptions.length} subscriptions`);
        return Response.json({ subscriptions });
      } else if (action === "subscribe" || action === "unsubscribe") {
        const voiceActorId = body.voice_actor_id;

        if (!voiceActorId) {
          console.error("[manage-subscription] 400 Bad Request. Missing voice_actor_id.");
          return Response.json(
            { error: "Missing 'voice_actor_id' for subscribe/unsubscribe" },
            { status: 400 },
          );
        }

        if (action === "subscribe") {
          console.log(`[manage-subscription] Subscribing user ${userId} to actor ${voiceActorId}`);
          const { error } = await ctx.supabase
            .from("voice_actor_subscriptions")
            .insert({ user_id: userId, voice_actor_id: voiceActorId });

          if (error && error.code !== "23505") { // Ignore unique constraint violation
            console.error("[manage-subscription] DB Error during subscribe:", error);
            throw error;
          }
        } else if (action === "unsubscribe") {
          console.log(`[manage-subscription] Unsubscribing user ${userId} from actor ${voiceActorId}`);
          const { error } = await ctx.supabase
            .from("voice_actor_subscriptions")
            .delete()
            .eq("user_id", userId)
            .eq("voice_actor_id", voiceActorId);

          if (error) {
            console.error("[manage-subscription] DB Error during unsubscribe:", error);
            throw error;
          }
        }

        console.log(`[manage-subscription] Action ${action} completed successfully.`);
        return Response.json({ ok: true });
      } else {
        console.error(`[manage-subscription] Invalid action requested: ${action}`);
        return Response.json(
          { error: "Invalid action" },
          { status: 400 },
        );
      }
    } catch (err) {
      console.error("[manage-subscription] Error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return Response.json(
        { error: errorMessage },
        { status: 500 },
      );
    }
  }),
};
