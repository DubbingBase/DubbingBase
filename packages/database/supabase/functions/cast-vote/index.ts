import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Database } from "../_shared/database.types.ts";
import { createErrorResponse, createResponse } from "../_shared/http-utils.ts";

import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
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
      const { error } = await ctx.supabaseAdmin.from("votes").upsert(
        {
          user_id: user.id,
          work_id: workId,
          vote_type,
        },
        {
          onConflict: "user_id,work_id",
        },
      );

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
  }),
};
