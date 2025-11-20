import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { Database } from "../_shared/database.types.ts";
import {
  createErrorResponse,
  createResponse,
  handleOptions,
} from "../_shared/http-utils.ts";
import { supabaseAdmin, supabaseUser } from "../_shared/database.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  try {
    const supabase = supabaseUser(req.headers.get("Authorization"));
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log("authError", authError);

    if (authError || !user) {
      return createErrorResponse("Unauthorized", 401);
    }

    const { work_id, vote_type } = await req.json();

    if (!work_id || !vote_type) {
      return createErrorResponse("Missing work_id or vote_type", 400);
    }

    if (!["up", "down"].includes(vote_type)) {
      return createErrorResponse(
        'Invalid vote_type. Must be "up" or "down"',
        400,
      );
    }

    const workId = parseInt(work_id, 10);
    if (isNaN(workId)) {
      return createErrorResponse("Invalid work_id", 400);
    }

    // Upsert vote
    const { error } = await supabaseAdmin
      .from("votes")
      .upsert({
        user_id: user.id,
        work_id: workId,
        vote_type,
      }, {
        onConflict: "user_id,work_id",
      });

    if (error) {
      console.error("Error upserting vote:", error);
      return createErrorResponse("Failed to cast vote", 500);
    }

    return createResponse({ success: true });
  } catch (error) {
    console.error("Error in cast-vote function:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "An unknown error occurred",
    );
  }
});
