import { useSupabaseAdmin } from "./client";
import { processVoiceActor } from "../urls/supabase";

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

export async function getDubbingProjects(
  contentId: number,
  contentType: string,
) {
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

  return (data || []).map((project: any) => ({
    ...project,
    works: (project.works || []).map((work: any) => ({
      ...work,
      voice_actor: processVoiceActor(work.voice_actor),
    })),
    studio_data: project.studio_data || {
      id: null,
      name: null,
      logo_url: null,
    },
    crew: (project.crew || []).map((member: any) => ({
      ...member,
      person: processVoiceActor(member.person),
    })),
  }));
}

export async function getWorkVotes(
  workIds: number[],
  userId?: string,
): Promise<
  Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  >
> {
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
