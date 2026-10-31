import { useSupabaseAdmin } from "./client";
import { processVoiceActor } from "../urls/supabase";
import type { MediaDetailVoiceActor, ToyDubbingProject } from "@app/shared-logic";

export async function getVoiceActorWithWork(id: number) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("voice_actors")
    .select("*, work(id, dubbing_projects(content_id, content_type))")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export async function getWorkByActor(actorId: number) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("work")
    .select("*, voice_actors(*), dubbing_projects(*)")
    .eq("actor_id", actorId);

  if (error) return [];
  return data || [];
}

export async function getActorPageWorkByActor(actorId: number) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("work")
    .select(
      `id,
      performance,
      voice_actors(id, firstname, lastname, profile_picture),
      dubbing_projects(language, content_id)`,
    )
    .eq("actor_id", actorId);

  if (error) return [];
  return data || [];
}

export async function getDubbingProjects(contentId: number, contentType: string) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select(
      `*,
       studio_data:studios(*),
       works:work(
         *,
         voice_actor:voice_actors(*)
       ),
       crew:dubbing_project_crew(
         id,
         person_id,
         job_id,
         job:jobs(*),
         person:voice_actors(*)
       )`,
    )
    .eq("content_id", contentId)
    .eq("content_type", contentType);

  if (error) return [];

  return (data || []).map((project) => ({
    ...project,
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: processVoiceActor(work.voice_actor),
    })),
    studio_data: project.studio_data || null,
    crew: (project.crew || []).map((member) => ({
      ...member,
      person: processVoiceActor(member.person),
    })),
  }));
}

const MEDIA_PAGE_DUBBING_PROJECTS_SELECT = `id,
  language,
  studio_data:studios(id, name, logo_url),
  works:work(
    id,
    actor_id,
    character_name,
    performance,
    note,
    voice_actor:voice_actors(id, firstname, lastname, profile_picture, voice_actor_name)
  )`;

const MEDIA_DETAIL_PAGE_DUBBING_PROJECTS_SELECT = `id,
  language,
  studio_data:studios(id, name, logo_url),
  works:work(
    id,
    actor_id,
    character_name,
    note,
    voice_actor:voice_actors(id, firstname, lastname, profile_picture)
  )`;

export async function getDubbingProjectsForMediaEndpoint(
  contentId: number,
  contentType: string,
  projection: unknown,
) {
  if (projection === "media-summary") {
    return await getMediaPageDubbingProjectSummaries(contentId, contentType);
  }

  if (projection === "advertisement-page") {
    return await getAdvertisementPageDubbingProjects(contentId);
  }

  if (projection === "podcast-page") {
    return await getPodcastPageDubbingProjects(contentId);
  }

  return projection === "media-page"
    ? await getMediaPageDubbingProjects(contentId, contentType)
    : await getDubbingProjects(contentId, contentType);
}

const ADVERTISEMENT_PAGE_DUBBING_PROJECTS_SELECT = `id,
  language,
  studio_data:studios(id, name, logo_url),
  works:work(
    id,
    actor_id,
    character_name,
    performance,
    note,
    voice_actor:voice_actors(id, firstname, lastname, profile_picture)
  ),
  crew:dubbing_project_crew(
    id,
    person_id,
    job_id,
    job:jobs(name),
    person:voice_actors(id, firstname, lastname, profile_picture)
  )`;

export async function getAdvertisementPageDubbingProjects(contentId: number) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select(ADVERTISEMENT_PAGE_DUBBING_PROJECTS_SELECT)
    .eq("content_id", contentId)
    .eq("content_type", "advertisement");

  if (error) return [];

  return (data || []).map((project) => ({
    ...project,
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: processVoiceActor(work.voice_actor),
    })),
    studio_data: project.studio_data || null,
    crew: (project.crew || []).map((member) => ({
      ...member,
      person: processVoiceActor(member.person),
    })),
  }));
}

export async function getMediaPageDubbingProjectData(contentId: number, contentType: string) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select(MEDIA_DETAIL_PAGE_DUBBING_PROJECTS_SELECT)
    .eq("content_id", contentId)
    .eq("content_type", contentType);

  if (error) return { dubbingProjects: [], voiceActors: [] };

  const voiceActorsById = new Map<number, MediaDetailVoiceActor>();
  const dubbingProjects = (data || []).map((project) => ({
    id: project.id,
    language: project.language,
    studio_data: project.studio_data || null,
    works: (project.works || []).map((work) => {
      const voiceActorId = work.voice_actor?.id ?? null;
      if (voiceActorId !== null && !voiceActorsById.has(voiceActorId) && work.voice_actor) {
        const voiceActor = processVoiceActor(work.voice_actor);
        voiceActorsById.set(voiceActorId, {
          id: voiceActorId,
          firstname: work.voice_actor.firstname,
          lastname: work.voice_actor.lastname,
          profile_picture: voiceActor.profile_picture,
        });
      }

      return {
        id: work.id,
        actor_id: work.actor_id,
        character_name: work.character_name,
        note: work.note,
        voice_actor_id: voiceActorId,
      };
    }),
  }));

  return { dubbingProjects, voiceActors: [...voiceActorsById.values()] };
}

export async function getMediaPageDubbingProjects(
  contentId: number,
  contentType: string,
  projectId?: number,
) {
  const supabase = useSupabaseAdmin();
  let query = supabase
    .from("dubbing_projects")
    .select(MEDIA_PAGE_DUBBING_PROJECTS_SELECT)
    .eq("content_id", contentId)
    .eq("content_type", contentType);

  if (projectId !== undefined) query = query.eq("id", projectId);

  const { data, error } = await query;

  if (error) return [];

  return (data || []).map((project) => ({
    ...project,
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: processVoiceActor(work.voice_actor),
    })),
    studio_data: project.studio_data || null,
    crew: [],
  }));
}

export async function getMediaPageDubbingProjectSummaries(contentId: number, contentType: string) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select(
      `id,
      language,
      studio_data:studios(id, name, logo_url),
      works:work(actor_id),
      crew:dubbing_project_crew(
        id,
        job:jobs(name),
        person:voice_actors(id, firstname, lastname)
      )`,
    )
    .eq("content_id", contentId)
    .eq("content_type", contentType);

  if (error) return [];

  return (data || []).map((project) => {
    const voiceActorIds = new Set(
      (project.works || []).flatMap((work) =>
        typeof work.actor_id === "number" ? [work.actor_id] : [],
      ),
    );
    return {
      id: project.id,
      language: project.language,
      studio_data: project.studio_data || null,
      has_voice_actor: voiceActorIds.size > 0,
      voice_actor_count: voiceActorIds.size,
      work_count: project.works?.length || 0,
      crew: (project.crew || []).map((member) => ({
        ...member,
        person: processVoiceActor(member.person),
      })),
    };
  });
}

const PODCAST_PAGE_DUBBING_PROJECTS_SELECT = `id,
  language,
  studio_data:studios(id, name, logo_url),
  works:work(
    id,
    actor_id,
    character_name,
    performance,
    note,
    voice_actor:voice_actors(id, firstname, lastname, profile_picture)
  ),
  crew:dubbing_project_crew(
    id,
    job:jobs(name),
    person:voice_actors(id, firstname, lastname)
  )`;

export async function getPodcastPageDubbingProjects(contentId: number) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select(PODCAST_PAGE_DUBBING_PROJECTS_SELECT)
    .eq("content_id", contentId)
    .eq("content_type", "podcast");

  if (error) return [];

  return (data || []).map((project) => ({
    ...project,
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: processVoiceActor(work.voice_actor),
    })),
    studio_data: project.studio_data || null,
    crew: (project.crew || []).map((member) => ({
      ...member,
      person: processVoiceActor(member.person),
    })),
  }));
}

const TOY_PAGE_DUBBING_PROJECTS_SELECT = `id,
  language,
  studio_data:studios(id, name),
  works:work(
    id,
    actor_id,
    character_name,
    performance,
    note,
    voice_actor:voice_actors(id, firstname, lastname, profile_picture)
  ),
  crew:dubbing_project_crew(
    id,
    job:jobs(name),
    person:voice_actors(id, firstname, lastname)
  )`;

export async function getToyPageDubbingProjects(contentId: number): Promise<ToyDubbingProject[]> {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select(TOY_PAGE_DUBBING_PROJECTS_SELECT)
    .eq("content_id", contentId)
    .eq("content_type", "toy");

  if (error) return [];

  return (data || []).map((project) => ({
    ...project,
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: processVoiceActor(work.voice_actor),
    })),
    studio_data: project.studio_data || null,
    crew: (project.crew || []).map((member) => ({
      ...member,
      person: processVoiceActor(member.person),
    })),
  }));
}

const GAME_PAGE_DUBBING_PROJECTS_SELECT = `id,
  language,
  studio_data:studios(id, name, logo_url),
  works:work(
    id,
    actor_id,
    character_id,
    character_name,
    voice_actor:voice_actors(id, firstname, lastname, profile_picture)
  )`;

export async function getGamePageDubbingProjects(contentId: number) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select(GAME_PAGE_DUBBING_PROJECTS_SELECT)
    .eq("content_id", contentId)
    .eq("content_type", "video_game");

  if (error) return [];

  return (data || []).map((project) => ({
    ...project,
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: processVoiceActor(work.voice_actor),
    })),
    studio_data: project.studio_data || null,
    crew: [],
  }));
}

const EPISODE_PAGE_DUBBING_PROJECTS_SELECT = `id,
  language,
  studio_data:studios(id, name, logo_url),
  works:work(
    id,
    actor_id,
    character_name,
    note,
    voice_actor:voice_actors(id, firstname, lastname, profile_picture)
  )`;

export async function getEpisodePageDubbingProjectData(
  contentId: number,
  preferredProjectId?: number,
  locale?: string,
) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select(EPISODE_PAGE_DUBBING_PROJECTS_SELECT)
    .eq("content_id", contentId)
    .eq("content_type", "tv");

  if (error) throw new Error("Failed to load episode dubbing projects");

  const voiceActorsById = new Map<
    number,
    {
      id: number;
      firstname?: string | null;
      lastname?: string | null;
      profile_picture?: string | null;
    }
  >();
  const projectsWithWorks = (data || []).map((project) => ({
    ...project,
    works: (project.works || []).map((work) => {
      const voiceActorId = work.voice_actor?.id ?? null;
      if (voiceActorId !== null && !voiceActorsById.has(voiceActorId)) {
        const voiceActor = processVoiceActor(work.voice_actor);
        voiceActorsById.set(voiceActor.id, {
          id: voiceActor.id,
          firstname: voiceActor.firstname,
          lastname: voiceActor.lastname,
          profile_picture: voiceActor.profile_picture,
        });
      }

      return {
        id: work.id,
        actor_id: work.actor_id,
        character_name: work.character_name,
        note: work.note,
        voice_actor_id: voiceActorId,
      };
    }),
    studio_data: project.studio_data || null,
  }));

  const visibleProjects = projectsWithWorks
    .map((project) => ({
      id: project.id,
      language: project.language,
      studio_data: project.studio_data,
      workCount: project.works.length,
      voiceActorCount: new Set(
        project.works.map((work) => work.voice_actor_id).filter((id): id is number => id !== null),
      ).size,
      works: project.works,
    }))
    .filter((project) => project.voiceActorCount > 0)
    .sort((a, b) => {
      const aPreferred = a.language?.toLowerCase().startsWith(locale?.toLowerCase() ?? "") ? 1 : 0;
      const bPreferred = b.language?.toLowerCase().startsWith(locale?.toLowerCase() ?? "") ? 1 : 0;
      return bPreferred - aPreferred || b.workCount - a.workCount;
    });
  const activeProject =
    visibleProjects.find((project) => project.id === preferredProjectId) || visibleProjects[0];

  return {
    dubbingProjects: visibleProjects.map(({ works: _works, ...project }) => project),
    activeProjectId: activeProject?.id ?? null,
    activeProjectWorks: activeProject?.works ?? [],
    voiceActors: activeProject
      ? [
          ...new Set(
            activeProject.works.map((work) => work.voice_actor_id).filter((id) => id !== null),
          ),
        ]
          .map((id) => voiceActorsById.get(id))
          .filter((actor) => actor !== undefined)
      : [],
  };
}

export async function getEpisodePageProjectWorks(contentId: number, projectId: number) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select(
      "id, works:work(id, actor_id, character_name, note, voice_actor:voice_actors(id, firstname, lastname, profile_picture))",
    )
    .eq("id", projectId)
    .eq("content_id", contentId)
    .eq("content_type", "tv")
    .maybeSingle();

  if (error) throw new Error("Failed to load episode project works");
  if (!data) return { projectId, works: [], voiceActors: [] };

  const voiceActorsById = new Map<
    number,
    {
      id: number;
      firstname?: string | null;
      lastname?: string | null;
      profile_picture?: string | null;
    }
  >();
  const works = (data.works || []).map((work) => {
    const voiceActorId = work.voice_actor?.id ?? null;
    if (voiceActorId !== null && work.voice_actor && !voiceActorsById.has(voiceActorId)) {
      const voiceActor = processVoiceActor(work.voice_actor);
      voiceActorsById.set(voiceActorId, {
        id: voiceActor.id,
        firstname: voiceActor.firstname,
        lastname: voiceActor.lastname,
        profile_picture: voiceActor.profile_picture,
      });
    }
    return {
      id: work.id,
      actor_id: work.actor_id,
      character_name: work.character_name,
      note: work.note,
      voice_actor_id: voiceActorId,
    };
  });

  return { projectId, works, voiceActors: [...voiceActorsById.values()] };
}

const SEASON_PAGE_DUBBING_PROJECTS_SELECT = `id,
  language,
  studio_data:studios(id, name, logo_url),
  works:work(voice_actor:voice_actors(id))`;

export async function getSeasonPageDubbingProjects(contentId: number, contentType: string) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select(SEASON_PAGE_DUBBING_PROJECTS_SELECT)
    .eq("content_id", contentId)
    .eq("content_type", contentType);

  if (error) return [];

  return (data || []).map((project) => {
    const works = project.works || [];
    const voiceActorIds = new Set<number>();
    let hasVoiceActor = false;

    for (const work of works) {
      if (work.voice_actor) {
        hasVoiceActor = true;
        if (work.voice_actor.id) voiceActorIds.add(work.voice_actor.id);
      }
    }

    return {
      id: project.id,
      language: project.language,
      studio_data: project.studio_data || null,
      has_voice_actor: hasVoiceActor,
      voice_actor_count: voiceActorIds.size,
      work_count: works.length,
    };
  });
}

export async function getWorkVotes(
  workIds: number[],
  userId?: string,
): Promise<Record<number, { up_count: number; down_count: number; user_vote: string | null }>> {
  if (workIds.length === 0) return {};

  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_work_votes_with_user", {
    p_work_ids: workIds,
    p_user_id: userId || undefined,
  });

  if (error) return {};

  // Initialize with zero counts (matches old DatabaseClient behavior)
  const voteMap: Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  > = {};
  for (const workId of workIds) {
    voteMap[workId] = { up_count: 0, down_count: 0, user_vote: null };
  }

  // Overwrite with actual data
  for (const row of data || []) {
    voteMap[row.work_id] = {
      up_count: row.up_count,
      down_count: row.down_count,
      user_vote: row.user_vote,
    };
  }
  return voteMap;
}

export async function getTopContributors(limit = 10) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_top_contributors", {
    limit_param: limit,
  });
  if (error) return [];
  return data || [];
}
