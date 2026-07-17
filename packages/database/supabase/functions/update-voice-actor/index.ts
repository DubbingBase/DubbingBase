import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

type VoiceActor = Database["public"]["Tables"]["voice_actors"]["Row"];

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    if (
      req.method !== "PUT" &&
      req.method !== "PATCH" &&
      req.method !== "POST"
    ) {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Parse request body
      const body = await req.json();
      const { voice_actor_id, updates, targetUserId } = body;

      if (!voice_actor_id) {
        return Response.json(
          { error: "voice_actor_id is required" },
          { status: 400 },
        );
      }

      // Determine which user to check permissions for
      const userIdToCheck = targetUserId || user.id;

      const isAdmin =
        user.appMetadata?.role === "admin" ||
        user.userMetadata?.role === "admin" ||
        user.role === "admin";

      if (!isAdmin) {
        // Check if the user has permission to update this voice actor
        const { data: linkData, error: linkError } = await ctx.supabase
          .from("user_voice_actor_links")
          .select("voice_actor_id")
          .eq("user_id", userIdToCheck)
          .eq("voice_actor_id", voice_actor_id)
          .single();

        if (linkError || !linkData) {
          return Response.json(
            { error: "Unauthorized to update this voice actor" },
            { status: 403 },
          );
        }
      }

      // Prepare update data
      const updateData: any = { ...updates };
      updateData.updated_at = new Date().toISOString();

      if (updateData.date_of_birth === "") {
        updateData.date_of_birth = null;
      }

      if (
        typeof updateData.profile_picture === "string" &&
        updateData.profile_picture.startsWith("http")
      ) {
        // Only attempt to process if it looks like an external URL
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "127.0.0.1";
        if (
          !updateData.profile_picture.includes(supabaseUrl) &&
          !updateData.profile_picture.includes("supabase.co")
        ) {
          try {
            const imgRes = await fetch(updateData.profile_picture);
            if (imgRes.ok) {
              const arrayBuffer = await imgRes.arrayBuffer();

              // Generate a unique path
              const ext =
                updateData.profile_picture.split(".").pop()?.split("?")[0] ||
                "jpg";
              const path = `${voice_actor_id}-${Date.now()}.${ext}`;

              const { error: uploadError } = await ctx.supabase.storage
                .from("voice_actor_profile_pictures")
                .upload(path, arrayBuffer, {
                  contentType:
                    imgRes.headers.get("content-type") || "image/jpeg",
                  upsert: true,
                });

              if (!uploadError) {
                // Save just the path so buildSupabaseImageUrl handles it correctly
                updateData.profile_picture = path;
              } else {
                console.error(
                  "Failed to upload image to storage:",
                  uploadError,
                );
              }
            }
          } catch (e) {
            console.error("Error downloading external image:", e);
          }
        }
      }

      // Update voice actor
      const { data: voiceActorData, error: vaError } = await ctx.supabase
        .from("voice_actors")
        .update(updateData)
        .eq("id", voice_actor_id)
        .select()
        .single();

      if (vaError) {
        console.error("Error updating voice actor:", vaError);
        return Response.json(
          { error: "Failed to update voice actor" },
          { status: 500 },
        );
      }

      return Response.json({ profile: voiceActorData });
    } catch (error) {
      console.error("Unexpected error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
