import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  requireUser(event);

  try {
    const body = await readBody(event);
    const { projectId, projectPayload, dubbingCrew, castRows } = body;

    if (!projectPayload || !projectPayload.content_id) {
      throw createError({
        statusCode: 400,
        message: "Missing content_id in projectPayload parameter",
      });
    }

    const supabase = event.context.supabaseAdmin || useSupabaseAdmin();
    let currentProjectId = projectId;

    if (currentProjectId) {
      const { error } = await supabase
        .from("dubbing_projects")
        .update(projectPayload)
        .eq("id", currentProjectId);
      if (error) throw error;
    } else {
      const { data: newProj, error } = await supabase
        .from("dubbing_projects")
        .insert([projectPayload])
        .select()
        .single();
      if (error) throw error;
      if (newProj) currentProjectId = newProj.id;
    }

    if (currentProjectId) {
      await supabase
        .from("dubbing_project_crew")
        .delete()
        .eq("dubbing_project_id", currentProjectId);

      if (dubbingCrew && dubbingCrew.length > 0) {
        const crewPayloads = dubbingCrew.map((c: any) => ({
          dubbing_project_id: currentProjectId,
          person_id: c.person_id,
          job_id: c.job_id,
        }));
        const { error: crewErr } = await supabase
          .from("dubbing_project_crew")
          .insert(crewPayloads);
        if (crewErr) throw crewErr;
      }

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

          const { error: workErr } = await supabase
            .from("work")
            .upsert([workPayload]);
          if (workErr) throw workErr;
        }
      }
    }

    return { success: true, projectId: currentProjectId };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Error in save-dubbing-project:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
