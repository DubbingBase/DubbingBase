import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const { type, payload } = await req.json();

      if (!type || !payload) {
        return Response.json(
          { error: "Missing type or payload" },
          { status: 400 },
        );
      }

      if (type === "job") {
        const { data, error } = await ctx.supabase
          .from("jobs")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return Response.json({ data });
      } else if (type === "voice_actor") {
        const { data, error } = await ctx.supabase
          .from("voice_actors")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return Response.json({ data });
      }

      return Response.json(
        { error: "Invalid type parameter" },
        { status: 400 },
      );
    } catch (error) {
      console.error("Error in save-metadata function:", error);
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
