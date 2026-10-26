import { useSupabaseAdmin } from "../utils/db/client";

type SupabaseAdmin = ReturnType<typeof useSupabaseAdmin>;

function findProject(supabase: SupabaseAdmin, id: number) {
  return supabase
    .from("dubbing_projects")
    .select("*")
    .or(`id.eq.${id},content_id.eq.${id}`)
    .limit(1);
}

function getProjectCrew(supabase: SupabaseAdmin, projectId: number) {
  return supabase
    .from("dubbing_project_crew")
    .select("*, voice_actors(firstname, lastname)")
    .eq("dubbing_project_id", projectId);
}

function getProjectWorks(supabase: SupabaseAdmin, projectId: number) {
  return supabase
    .from("work")
    .select("*, voice_actors(id, firstname, lastname)")
    .eq("dubbing_project_id", projectId);
}

type ProjectRow = NonNullable<Awaited<ReturnType<typeof findProject>>["data"]>[number];
type CrewRows = NonNullable<Awaited<ReturnType<typeof getProjectCrew>>["data"]>;
type WorkRows = NonNullable<Awaited<ReturnType<typeof getProjectWorks>>["data"]>;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const numericId = query.numericId !== undefined ? Number(query.numericId) : undefined;

  if (numericId === undefined || isNaN(numericId)) {
    throw createError({
      statusCode: 400,
      message: "Missing or invalid numericId parameter",
    });
  }

  const supabaseAdmin = useSupabaseAdmin();

  try {
    let project: ProjectRow | null = null;
    const { data: projects, error: projErr } = await findProject(supabaseAdmin, numericId);

    if (projErr) throw projErr;

    if (projects && projects.length > 0) {
      project = projects[0];
    }

    let crewData: CrewRows = [];
    let worksData: WorkRows = [];

    if (project) {
      const { data: crew, error: crewErr } = await getProjectCrew(supabaseAdmin, project.id);

      if (crewErr) throw crewErr;
      crewData = crew || [];

      const { data: works, error: worksErr } = await getProjectWorks(supabaseAdmin, project.id);

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
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("Error in get-dubbing-project route:", error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
