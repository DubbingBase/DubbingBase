import { SupabaseContext } from "npm:@supabase/server@^1";
import { Database } from "./database.types.ts";
import { IDatabaseClient } from "./interfaces.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_PUBLISHABLE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const SUPABASE_SECRET_KEY = Deno.env.get("SUPABASE_SECRET_KEY")!;

function debugLog(message: string, data?: any) {
  console.log(
    `[DATABASE] ${message}`,
    data ? JSON.stringify(data, null, 2) : "",
  );
}

export class DatabaseClient implements IDatabaseClient {
  private ctx: SupabaseContext<Database>;

  constructor(ctx: SupabaseContext<Database>) {
    this.ctx = ctx;
  }

  async getWorkWithVoiceActors(contentId: number) {
    debugLog("Fetching work with voice actors", { contentId });

    const { data, error } = await this.ctx.supabaseAdmin
      .from("work")
      .select(`*, voiceActorDetails:voice_actors (*)`)
      .eq("content_id", contentId);

    if (error) {
      debugLog("Error fetching work with voice actors", {
        error: error.message,
      });
      throw error;
    }

    debugLog("Work data retrieved", {
      count: data?.length || 0,
      sample: data?.[0],
    });

    return data;
  }

  async getVoiceActorWithWork(voiceActorId: number) {
    debugLog("Fetching voice actor with work", { voiceActorId });

    const { data, error } = await this.ctx.supabase
      .from("voice_actors")
      .select(`*, work (*), user_voice_actor_links(id)`)
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
        voice_actors (*)
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
    // Get all votes for the specified work entries, including user_id to map user's specific vote
    const { data: votes, error } = await this.ctx.supabase
      .from("votes")
      .select("work_id, vote_type, user_id")
      .in("work_id", workIds);

    if (error) throw error;

    // Aggregate vote counts and user's specific vote in a single loop
    const voteCounts: Record<
      number,
      { up_count: number; down_count: number; user_vote: string | null }
    > = {};

    // Initialize with zero counts
    workIds.forEach((workId) => {
      voteCounts[workId] = { up_count: 0, down_count: 0, user_vote: null };
    });

    // Process all votes in a single pass
    votes.forEach((vote) => {
      const counts = voteCounts[vote.work_id];
      if (counts) {
        if (vote.vote_type === "up") {
          counts.up_count++;
        } else if (vote.vote_type === "down") {
          counts.down_count++;
        }
        // If this vote belongs to the requested user, mark it
        if (userId && vote.user_id === userId) {
          counts.user_vote = vote.vote_type;
        }
      }
    });

    return voteCounts;
  }
}
