import { SupabaseContext } from "npm:@supabase/server@^1";
import { Database } from "./database.types.ts";
import { processVoiceActor } from "./supabase-urls.ts";

function debugLog(message: string, data?: any) {
  console.log(
    `[DATABASE] ${message}`,
    data ? JSON.stringify(data, null, 2) : "",
  );
}

export class DatabaseClient {
  private ctx: SupabaseContext<Database>;

  constructor(ctx: SupabaseContext<Database>) {
    this.ctx = ctx;
  }

  async getVoiceActorWithWork(voiceActorId: number) {
    debugLog("Fetching voice actor with work", { voiceActorId });

    const { data, error } = await this.ctx.supabase
      .from("voice_actors")
      .select(`*, work (*, dubbing_projects(*)), user_voice_actor_links(id)`)
      .eq("id", voiceActorId)
      .single();

    if (error) {
      debugLog("Error fetching voice actor", { error: error.message });
      throw error;
    }

    debugLog("Raw voice actor data received", {
      hasProfilePicture: !!data.profile_picture,
      workCount: data.work?.length || 0,
    });

    return data;
  }

  async getWorkByActor(actorId: number) {
    const { data, error } = await this.ctx.supabase
      .from("work")
      .select(
        `
        *,
        voice_actors (*),
        dubbing_projects (*)
      `,
      )
      .eq("actor_id", actorId);

    if (error) throw error;

    return data;
  }

  async getWorkVotes(
    workIds: number[],
    userId?: string,
  ): Promise<
    Record<
      number,
      { up_count: number; down_count: number; user_vote: string | null }
    >
  > {
    if (workIds.length === 0) return {};

    const { data: votes, error } = await this.ctx.supabase.rpc(
      "get_work_votes_with_user",
      {
        p_work_ids: workIds,
        p_user_id: userId,
      },
    );

    if (error) {
      console.error("Error calling get_work_votes_with_user RPC:", error);
      throw error;
    }

    const voteCounts: Record<
      number,
      { up_count: number; down_count: number; user_vote: string | null }
    > = {};

    // Initialize with zero counts
    workIds.forEach((workId) => {
      voteCounts[workId] = { up_count: 0, down_count: 0, user_vote: null };
    });

    if (votes) {
      votes.forEach((vote) => {
        voteCounts[vote.work_id] = {
          up_count: vote.up_count,
          down_count: vote.down_count,
          user_vote: vote.user_vote,
        };
      });
    }

    return voteCounts;
  }
  async getDubbingProjects(contentId: number, contentType: string) {
    debugLog("Fetching dubbing projects", { contentId, contentType });

    const { data, error } = await this.ctx.supabase
      .from("dubbing_projects")
      .select(
        `
        *,
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
        )
      `,
      )
      .eq("content_id", contentId)
      .eq("content_type", contentType);

    if (error) {
      debugLog("Error fetching dubbing projects", { error: error.message });
      throw error;
    }

    const processedData = data?.map((project) => ({
      ...project,
      works: project.works?.map((work) => ({
        ...work,
        voice_actor: processVoiceActor(this.ctx, work.voice_actor),
      })),
      crew: project.crew?.map((member) => ({
        ...member,
        person: processVoiceActor(this.ctx, member.person),
      })),
    }));

    return processedData;
  }
}
