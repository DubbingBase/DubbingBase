import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const numericId =
    query.numericId !== undefined ? Number(query.numericId) : undefined;

  if (numericId === undefined || isNaN(numericId)) {
    throw createError({
      statusCode: 400,
      message: "Missing or invalid numericId parameter",
    });
  }

  const supabaseAdmin = useSupabaseAdmin();

  try {
    let project = null;
    const { data: projects, error: projErr } = await supabaseAdmin
      .from("dubbing_projects")
      .select("*")
      .or(`id.eq.${numericId},content_id.eq.${numericId}`)
      .limit(1);

    if (projErr) throw projErr;

    if (projects && projects.length > 0) {
      project = projects[0];
    }

    let crewData: any[] = [];
    let worksData: any[] = [];

    if (project) {
      const { data: crew, error: crewErr } = await supabaseAdmin
        .from("dubbing_project_crew")
        .select("*, voice_actors(firstname, lastname)")
        .eq("dubbing_project_id", project.id);

      if (crewErr) throw crewErr;
      crewData = crew || [];

      const { data: works, error: worksErr } = await supabaseAdmin
        .from("work")
        .select("*, voice_actors(id, firstname, lastname)")
        .eq("dubbing_project_id", project.id);

      if (worksErr) throw worksErr;
      worksData = works || [];
    }

    const { data: jobs } = await supabaseAdmin
      .from("jobs")
      .select("id, name")
      .order("name", { ascending: true });
    const { data: studios } = await supabaseAdmin
      .from("studios")
      .select("id, name")
      .order("name", { ascending: true });
    const { data: voiceActors } = await supabaseAdmin
      .from("voice_actors")
      .select("id, firstname, lastname")
      .order("lastname", { ascending: true });

    return {
      project,
      crewData,
      worksData,
      metadata: {
        jobs: jobs || [],
        studios: studios || [],
        voiceActors: voiceActors || [],
      },
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Error in get-dubbing-project route:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
