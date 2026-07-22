import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "publishable:*" }, async (req, ctx) => {
    try {
      const { numericId } = await req.json();

      if (numericId === undefined || isNaN(Number(numericId))) {
        return Response.json(
          { error: "Missing or invalid numericId parameter" },
          { status: 400 },
        );
      }

      let project = null;
      const { data: projects, error: projErr } = await ctx.supabase
        .from("dubbing_projects")
        .select("*")
        .or(`id.eq.${numericId},content_id.eq.${numericId}`)
        .limit(1);

      if (projErr) throw projErr;

      if (projects && projects.length > 0) {
        project = projects[0];
      }

      type CrewItem =
        Database["public"]["Tables"]["dubbing_project_crew"]["Row"] & {
          voice_actors: {
            firstname: string | null;
            lastname: string | null;
          } | null;
        };
      let crewData: CrewItem[] = [];

      type WorkItem = Database["public"]["Tables"]["work"]["Row"] & {
        voice_actors: {
          id: number;
          firstname: string | null;
          lastname: string | null;
        } | null;
      };
      let worksData: WorkItem[] = [];

      if (project) {
        const { data: crew, error: crewErr } = await ctx.supabase
          .from("dubbing_project_crew")
          .select("*, voice_actors(firstname, lastname)")
          .eq("dubbing_project_id", project.id);

        if (crewErr) throw crewErr;
        crewData = crew || [];

        const { data: works, error: worksErr } = await ctx.supabase
          .from("work")
          .select("*, voice_actors(id, firstname, lastname)")
          .eq("dubbing_project_id", project.id);

        if (worksErr) throw worksErr;
        worksData = works || [];
      }

      // Fetch metadata lists for the edit form
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
        project,
        crewData,
        worksData,
        metadata: {
          jobs: jobs || [],
          studios: studios || [],
          voiceActors: voiceActors || [],
        },
      });
    } catch (error) {
      console.error("Error in get-dubbing-project function:", error);
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
