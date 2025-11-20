import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { Database } from "../_shared/database.types.ts";
import {
  createErrorResponse,
  createResponse,
  handleOptions,
} from "../_shared/http-utils.ts";
import { supabaseAdmin, supabaseUser } from "../_shared/database.ts";
import { SimpleCache } from "../_shared/cache-utils.ts";
import { RedisClient } from "../_shared/redis.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  try {
    const supabase = supabaseUser(req.headers.get("Authorization"));
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse("Unauthorized", 401);
    }

    const { work_id, reviewed_status } = await req.json();

    console.log("Received request body:", { work_id, reviewed_status });

    if (!work_id || !reviewed_status) {
      console.log("Missing required fields:", { work_id: !!work_id, reviewed_status: !!reviewed_status });
      return createErrorResponse("work_id and reviewed_status are required", 400);
    }

    // Validate reviewed_status
    const validStatuses = ["waiting", "accepted", "rejected"];
    if (!validStatuses.includes(reviewed_status)) {
      console.log("Invalid reviewed_status:", reviewed_status, "valid options:", validStatuses);
      return createErrorResponse("Invalid reviewed_status value", 400);
    }

    // Check if user is admin
    const isAdmin = user.app_metadata?.role === "admin" ||
                   user.user_metadata?.role === "admin" ||
                   user.role === "admin";

    console.log("User role check:", { isAdmin, user_metadata: user.user_metadata, app_metadata: user.app_metadata, role: user.role });

    let canUpdate = isAdmin;

    if (!canUpdate) {
      console.log("User is not admin, checking voice actor permissions");

      // Check if user is the voice actor for this work
      const { data: workData, error: workError } = await supabase
        .from("work")
        .select("voice_actor_id")
        .eq("id", work_id)
        .single();

      if (workError) {
        console.log("Work lookup error:", workError);
        return createErrorResponse("Work not found", 404);
      }

      console.log("Work data found:", { voice_actor_id: workData.voice_actor_id });

      // Check if user has this voice actor profile
      const { data: userVoiceActor, error: vaError } = await supabase
        .from("user_voice_actor_links")
        .select("voice_actor_id")
        .eq("user_id", user.id)
        .eq("voice_actor_id", workData.voice_actor_id!)
        .single();

      if (vaError) {
        console.log("Voice actor link lookup error:", vaError);
      }

      canUpdate = !!userVoiceActor;
      console.log("Voice actor permission check:", { canUpdate, userVoiceActor: !!userVoiceActor });
    }

    if (!canUpdate) {
      console.log("User does not have permission to update this work");
      return createErrorResponse("Insufficient permissions", 403);
    }

    // Log before update
    console.log("Attempting to update work_id:", work_id, "with reviewed_status:", reviewed_status);

    // Update the review status
    const { data, error } = await supabaseAdmin
      .from("work")
      .update({ reviewed_status })
      .eq("id", work_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating review status:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return createErrorResponse("Failed to update review status", 500);
    }

    console.log("Update successful, returned data:", JSON.stringify(data, null, 2));

    // Invalidate cache for this work's content
    try {
      const cache = new SimpleCache(new RedisClient());
      // Use data from the update response which includes content_id and content_type
      const contentId = data.content_id;
      const contentType = data.content_type || 'movie';

      if (contentId) {
        const cacheKey = `tmdb:${contentType}:${contentId}`;
        console.log("Invalidating cache for key:", cacheKey);
        await cache.del(cacheKey);

        // Also invalidate aggregate credits cache if it's a TV show
        if (contentType === 'tv') {
          const aggregateCacheKey = `tmdb:tv:${contentId}:aggregate_credits`;
          console.log("Invalidating aggregate credits cache for key:", aggregateCacheKey);
          await cache.del(aggregateCacheKey);
        }
      }
    } catch (cacheError) {
      console.error("Failed to invalidate cache:", cacheError);
      // Don't fail the request if cache invalidation fails
    }

    return createResponse({ success: true, data });
  } catch (error) {
    console.error("Error in update-review-status function:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "An unknown error occurred",
    );
  }
});