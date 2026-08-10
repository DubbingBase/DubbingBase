import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getParams } from "../_shared/index.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { type } = await getParams(req);

      if (type === "jobs") {
        const { data, error } = await ctx.supabase
          .from("jobs")
          .select("id, name")
          .order("name", { ascending: true });
        if (error) throw error;
        return Response.json({ data });
      } else if (type === "studios") {
        const { data, error } = await ctx.supabase
          .from("studios")
          .select("id, name")
          .order("name", { ascending: true });
        if (error) throw error;
        return Response.json({ data });
      } else if (type === "voice_actors") {
        const { data, error } = await ctx.supabase
          .from("voice_actors")
          .select("id, firstname, lastname")
          .order("lastname", { ascending: true });
        if (error) throw error;
        return Response.json({ data });
      } else if (type === "all") {
        const { data: jobs } = await ctx.supabase
          .from("jobs")
          .select("id, name")
          .order("name", { ascending: true });
        const { data: studios } = await ctx.supabase
          .from("studios")
          .select("id, name")
          .order("name", { ascending: true });
        const { data: voiceActors } = await ctx.supabase
          .from("voice_actors")
          .select("id, firstname, lastname")
          .order("lastname", { ascending: true });

        return Response.json({
          jobs: jobs || [],
          studios: studios || [],
          voiceActors: voiceActors || [],
        });
      }

      return Response.json(
        { error: "Invalid type parameter" },
        { status: 400 },
      );
    } catch (error) {
      console.error("Error in get-metadata function:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
        },
        { status: 500 },
      );
    }
  }),
};
