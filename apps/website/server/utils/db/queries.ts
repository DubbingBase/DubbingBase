import { useSupabaseAdmin } from "./client";
import { processVoiceActor } from "../urls/supabase";
import type { ToyDubbingProject } from "@app/shared-logic";

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

export async function getDubbingProjectsForMediaEndpoint(
  contentId: number,
  contentType: string,
  projection: unknown,
) {
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

export async function getMediaPageDubbingProjects(contentId: number, contentType: string) {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from("dubbing_projects")
    .select(MEDIA_PAGE_DUBBING_PROJECTS_SELECT)
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
    crew: [],
  }));
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
    game_character_id,
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

  return (data || []).map((project) => ({
    ...project,
    works: project.works || [],
    studio_data: project.studio_data || null,
  }));
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
