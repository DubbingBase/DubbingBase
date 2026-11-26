import { useSupabaseAdmin } from "./client";
import { isKnownActor, isKnownMedia } from "./known-content-ids";
import {
  MEDIA_EMBED,
  MEDIA_FILTER_EMBED,
  isMediaKind,
  eqMediaRef,
  mediaRefFromEmbed,
  type MediaDetailVoiceActor,
  type ToyDubbingProject,
} from "@app/shared-logic";

function omitMedia<T extends { media: unknown }>({ media: _media, ...rest }: T): Omit<T, "media"> {
  return rest;
}

/** Re-expose the provider reference of an embedded media as the legacy `content_id`/`content_type` pair. */
export function withContentRef<T extends { media: Parameters<typeof mediaRefFromEmbed>[0] }>(
  project: T,
) {
  const ref = mediaRefFromEmbed(project.media);
  return {
    ...omitMedia(project),
    content_id: ref?.contentId ?? null,
    content_type: ref?.contentType ?? null,
  };
}

export async function getWorkByActor(actorId: number) {
  if (!(await isKnownActor(actorId))) return [];
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("work")
    .select(`*, voice_actors(*), dubbing_projects(*, ${MEDIA_EMBED})`)
    .eq("actor_id", actorId);

  if (error) return [];
  return (data || []).map((row) => ({
    ...row,
    dubbing_projects: row.dubbing_projects ? withContentRef(row.dubbing_projects) : null,
  }));
}

export async function getActorPageWorkByActor(actorId: number) {
  if (!(await isKnownActor(actorId))) return [];
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("work")
    .select(
      `id,
      performance,
      reviewed_status,
      voice_actors(id, firstname, lastname, profile_picture),
      dubbing_projects(language, ${MEDIA_EMBED})`,
    )
    .eq("actor_id", actorId);

  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    dubbing_projects: row.dubbing_projects ? withContentRef(row.dubbing_projects) : null,
  }));
}

export async function getDubbingProjects(contentId: number, contentType: string) {
  const supabase = useSupabaseAdmin();
  if (!isMediaKind(contentType)) return [];
  const kind = contentType;
  if (!(await isKnownMedia(kind, contentId))) return [];
  const { data, error } = await eqMediaRef(
    supabase.from("dubbing_projects").select(`id,
       language,
       studio_data:studios(id, name, logo_url),
       works:work(
         id,
         actor_id,
         voice_actor_id,
         game_character_id,
         character_name,
         performance,
         note,
         reviewed_status,
         voice_actor:voice_actors(id, firstname, lastname, profile_picture, voice_actor_name)
       ),
       crew:dubbing_project_crew(
         id,
         person_id,
         job_id,
         job:jobs(id, name),
         person:voice_actors(id, firstname, lastname, profile_picture)
       ),
       ${MEDIA_FILTER_EMBED}`),
    kind,
    contentId,
  );

  if (error) return [];

  return (data || []).map((project) => ({
    ...omitMedia(project),
    content_id: contentId,
    content_type: kind,
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: work.voice_actor ?? null,
    })),
    studio_data: project.studio_data ?? null,
    crew: (project.crew || []).map((member) => ({
      ...member,
      person: member.person ?? null,
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
    reviewed_status,
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
    reviewed_status,
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
  if (!(await isKnownMedia("advertisement", contentId))) return [];
  const supabase = useSupabaseAdmin();
  const { data, error } = await eqMediaRef(
    supabase
      .from("dubbing_projects")
      .select(`${ADVERTISEMENT_PAGE_DUBBING_PROJECTS_SELECT}, ${MEDIA_FILTER_EMBED}`),
    "advertisement",
    contentId,
  );

  if (error) return [];

  return (data || []).map((project) => ({
    ...omitMedia(project),
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: work.voice_actor ?? null,
    })),
    studio_data: project.studio_data ?? null,
    crew: (project.crew || []).map((member) => ({
      ...member,
      person: member.person ?? null,
    })),
  }));
}

export async function getMediaPageDubbingProjectData(contentId: number, contentType: string) {
  const supabase = useSupabaseAdmin();
  if (!isMediaKind(contentType)) return { dubbingProjects: [], voiceActors: [] };
  const kind = contentType;
  if (!(await isKnownMedia(kind, contentId))) return { dubbingProjects: [], voiceActors: [] };
  const { data, error } = await eqMediaRef(
    supabase
      .from("dubbing_projects")
      .select(`${MEDIA_DETAIL_PAGE_DUBBING_PROJECTS_SELECT}, ${MEDIA_FILTER_EMBED}`),
    kind,
    contentId,
  );

  if (error) return { dubbingProjects: [], voiceActors: [] };

  const voiceActorsById = new Map<number, MediaDetailVoiceActor>();
  const dubbingProjects = (data || []).map((project) => ({
    id: project.id,
    language: project.language,
    studio_data: project.studio_data ?? null,
    works: (project.works || []).map((work) => {
      const voiceActorId = work.voice_actor?.id ?? null;
      if (voiceActorId !== null && !voiceActorsById.has(voiceActorId) && work.voice_actor) {
        const voiceActor = work.voice_actor;
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
        reviewed_status: work.reviewed_status,
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
  if (!isMediaKind(contentType)) return [];
  const kind = contentType;
  if (!(await isKnownMedia(kind, contentId))) return [];
  let query = eqMediaRef(
    supabase
      .from("dubbing_projects")
      .select(`${MEDIA_PAGE_DUBBING_PROJECTS_SELECT}, ${MEDIA_FILTER_EMBED}`),
    kind,
    contentId,
  );

  if (projectId !== undefined) query = query.eq("id", projectId);

  const { data, error } = await query;

  if (error) return [];

  return (data || []).map((project) => ({
    ...omitMedia(project),
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: work.voice_actor ?? null,
    })),
    studio_data: project.studio_data ?? null,
    crew: [],
  }));
}

export async function getMediaPageDubbingProjectSummaries(contentId: number, contentType: string) {
  const supabase = useSupabaseAdmin();
  if (!isMediaKind(contentType)) return [];
  const kind = contentType;
  if (!(await isKnownMedia(kind, contentId))) return [];
  const { data, error } = await eqMediaRef(
    supabase.from("dubbing_projects").select(`id,
      language,
      studio_data:studios(id, name, logo_url),
      works:work(actor_id),
      crew:dubbing_project_crew(
        id,
        job:jobs(name),
        person:voice_actors(id, firstname, lastname)
      ),
       ${MEDIA_FILTER_EMBED}`),
    kind,
    contentId,
  );

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
      studio_data: project.studio_data ?? null,
      has_voice_actor: voiceActorIds.size > 0,
      voice_actor_count: voiceActorIds.size,
      work_count: project.works?.length || 0,
      crew: (project.crew || []).map((member) => ({
        ...member,
        person: member.person ?? null,
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
  if (!(await isKnownMedia("podcast", contentId))) return [];
  const supabase = useSupabaseAdmin();
  const { data, error } = await eqMediaRef(
    supabase
      .from("dubbing_projects")
      .select(`${PODCAST_PAGE_DUBBING_PROJECTS_SELECT}, ${MEDIA_FILTER_EMBED}`),
    "podcast",
    contentId,
  );

  if (error) return [];

  return (data || []).map((project) => ({
    ...omitMedia(project),
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: work.voice_actor ?? null,
    })),
    studio_data: project.studio_data ?? null,
    crew: (project.crew || []).map((member) => ({
      ...member,
      person: member.person ?? null,
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
  if (!(await isKnownMedia("toy", contentId))) return [];
  const supabase = useSupabaseAdmin();
  const { data, error } = await eqMediaRef(
    supabase
      .from("dubbing_projects")
      .select(`${TOY_PAGE_DUBBING_PROJECTS_SELECT}, ${MEDIA_FILTER_EMBED}`),
    "toy",
    contentId,
  );

  if (error) return [];

  return (data || []).map((project) => ({
    ...omitMedia(project),
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: work.voice_actor ?? null,
    })),
    studio_data: project.studio_data || null,
    crew: (project.crew || []).map((member) => ({
      ...member,
      person: member.person ?? null,
    })),
  }));
}

const GAME_PAGE_DUBBING_PROJECTS_SELECT = `id,
  language,
  studio_data:studios(id, name, logo_url),
  works:work(
    id,
    actor_id,
    game_character_id,
    character_name,
    performance,
    note,
    highlight,
    voice_actor:voice_actors(id, firstname, lastname, profile_picture)
  )`;

export async function getGamePageDubbingProjects(contentId: number) {
  if (!(await isKnownMedia("video_game", contentId))) return [];
  const supabase = useSupabaseAdmin();
  const { data, error } = await eqMediaRef(
    supabase
      .from("dubbing_projects")
      .select(`${GAME_PAGE_DUBBING_PROJECTS_SELECT}, ${MEDIA_FILTER_EMBED}`),
    "video_game",
    contentId,
  );

  if (error) return [];

  return (data || []).map((project) => ({
    ...omitMedia(project),
    works: (project.works || []).map((work) => ({
      ...work,
      voice_actor: work.voice_actor ?? null,
    })),
    studio_data: project.studio_data ?? null,
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
    reviewed_status,
    voice_actor:voice_actors(id, firstname, lastname, profile_picture)
  )`;

export async function getEpisodePageDubbingProjectData(
  contentId: number,
  preferredProjectId?: number,
  locale?: string,
) {
  if (!(await isKnownMedia("tv", contentId))) {
    return { dubbingProjects: [], activeProjectId: null, activeProjectWorks: [], voiceActors: [] };
  }
  const supabase = useSupabaseAdmin();
  const { data, error } = await eqMediaRef(
    supabase
      .from("dubbing_projects")
      .select(`${EPISODE_PAGE_DUBBING_PROJECTS_SELECT}, ${MEDIA_FILTER_EMBED}`),
    "tv",
    contentId,
  );

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
    ...omitMedia(project),
    works: (project.works || []).map((work) => {
      const voiceActorId = work.voice_actor?.id ?? null;
      if (voiceActorId !== null && !voiceActorsById.has(voiceActorId) && work.voice_actor) {
        const voiceActor = work.voice_actor;
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
        reviewed_status: work.reviewed_status,
        voice_actor_id: voiceActorId,
      };
    }),
    studio_data: project.studio_data ?? null,
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
  if (!(await isKnownMedia("tv", contentId))) return { projectId, works: [], voiceActors: [] };
  const supabase = useSupabaseAdmin();
  const { data, error } = await eqMediaRef(
    supabase
      .from("dubbing_projects")
      .select(
        `id, works:work(id, actor_id, character_name, note, voice_actor:voice_actors(id, firstname, lastname, profile_picture)), ${MEDIA_FILTER_EMBED}`,
      )
      .eq("id", projectId),
    "tv",
    contentId,
  ).maybeSingle();

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
      const voiceActor = work.voice_actor;
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
  if (!isMediaKind(contentType)) return [];
  const kind = contentType;
  if (!(await isKnownMedia(kind, contentId))) return [];
  const { data, error } = await eqMediaRef(
    supabase
      .from("dubbing_projects")
      .select(`${SEASON_PAGE_DUBBING_PROJECTS_SELECT}, ${MEDIA_FILTER_EMBED}`),
    kind,
    contentId,
  );

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
      studio_data: project.studio_data ?? null,
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
