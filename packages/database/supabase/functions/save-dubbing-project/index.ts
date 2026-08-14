import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { purgeMediaForProject } from "../_shared/cache-purge.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const { projectId, projectPayload, dubbingCrew, castRows } =
        await req.json();

      if (!projectPayload || !projectPayload.content_id) {
        return Response.json(
          { error: "Missing content_id in projectPayload parameter" },
          { status: 400 },
        );
      }

      let currentProjectId = projectId;

      if (currentProjectId) {
        const { error } = await ctx.supabase
          .from("dubbing_projects")
          .update(projectPayload)
          .eq("id", currentProjectId);
        if (error) throw error;
      } else {
        const { data: newProj, error } = await ctx.supabase
          .from("dubbing_projects")
          .insert([projectPayload])
          .select()
          .single();
        if (error) throw error;
        if (newProj) currentProjectId = newProj.id;
      }

      if (currentProjectId) {
        // Save Dubbing Crew
        await ctx.supabase
          .from("dubbing_project_crew")
          .delete()
          .eq("dubbing_project_id", currentProjectId);

        if (dubbingCrew && dubbingCrew.length > 0) {
          const crewPayloads = dubbingCrew.map((c: any) => ({
            dubbing_project_id: currentProjectId,
            person_id: c.person_id,
            job_id: c.job_id,
          }));
          const { error: crewErr } = await ctx.supabase
            .from("dubbing_project_crew")
            .insert(crewPayloads);
          if (crewErr) throw crewErr;
        }

        // Save cast rows / works
        if (castRows && castRows.length > 0) {
          for (const row of castRows) {
            if (!row.actor_id) continue;
            const workPayload: any = {
              dubbing_project_id: currentProjectId,
              actor_id: row.actor_id,
              voice_actor_id: row.voice_actor_id || null,
              performance: row.performance || "dialogues",
              highlight: row.highlight || false,
              status: "validated",
            };
            if (row.id) workPayload.id = row.id;

            const { error: workErr } = await ctx.supabase
              .from("work")
              .upsert([workPayload]);
            if (workErr) throw workErr;
          }
        }
      }

      await purgeMediaForProject(ctx.supabaseAdmin, currentProjectId);

      return Response.json({ success: true, projectId: currentProjectId });
    } catch (error) {
      console.error("Error in save-dubbing-project function:", error);
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
