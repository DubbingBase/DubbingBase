import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { SupabaseContext } from "npm:@supabase/server@^1";

interface TopContributorsParams {
  limit?: number;
}

const getTopContributors = async (
  ctx: SupabaseContext<Database>,
  limit = 10,
) => {
  try {
    const { data, error } = await ctx.supabase.rpc("get_top_contributors", {
      limit_param: limit,
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Error fetching top contributors:", error);
    throw error;
  }
};

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { limit = 10 }: TopContributorsParams = await req
        .json()
        .catch(() => ({}));

      if (typeof limit !== "number" || limit < 1 || limit > 100) {
        return Response.json(
          { error: "Limit must be a number between 1 and 100" },
          { status: 400 },
        );
      }

      const results = await getTopContributors(ctx, limit);

      return Response.json(results);
    } catch (error) {
      console.error("Error in top-contributors function:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
