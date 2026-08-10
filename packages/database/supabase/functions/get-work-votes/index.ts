import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getParams } from "../_shared/index.ts";
import { Database } from "../_shared/database.types.ts";
import { createResponse, createErrorResponse } from "../_shared/http-utils.ts";
import { DatabaseClient } from "../_shared/database.ts";
import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { work_ids } = await getParams(req);

      if (!work_ids || !Array.isArray(work_ids) || work_ids.length === 0) {
        return createErrorResponse("Missing or invalid work_ids array", 400);
      }

      // Validate work_ids are numbers
      const validWorkIds = work_ids.filter(
        (id) => typeof id === "number" && !isNaN(id),
      );
      if (validWorkIds.length !== work_ids.length) {
        return createErrorResponse("All work_ids must be valid numbers", 400);
      }

      // Use shared DatabaseClient for database queries
      const dbClient = new DatabaseClient(ctx);

      // Get vote data - conditional auth for user-specific data
      let voteData: Record<
        number,
        { up_count: number; down_count: number; user_vote: string | null }
      > = {};
      try {
        const user = ctx.userClaims;
        if (user) {
          voteData = await dbClient.getWorkVotes(validWorkIds, user.id);
        } else {
          voteData = await dbClient.getWorkVotes(validWorkIds);
        }
      } catch (voteError) {
        console.error("Error fetching vote data:", voteError);
        // Continue without vote data - don't fail the entire request
      }

      return createResponse(voteData);
    } catch (error) {
      console.error("Error in get-work-votes function:", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    }
  }),
};
