import { createClient } from "jsr:@supabase/supabase-js";
import { Database } from "./database.types.ts";
import { IDatabaseClient } from "./interfaces.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Debug logging function
function debugLog(message: string, data?: any) {
  console.log(
    `[DATABASE] ${message}`,
    data ? JSON.stringify(data, null, 2) : "",
  );
}

debugLog("Initializing database client", {
  hasUrl: !!supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  hasServiceKey: !!supabaseServiceKey,
  url: supabaseUrl,
});

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);
const supabaseUser = (user?: string | null) =>
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: user
        ? {
          Authorization: user,
        }
        : {},
    },
  });

// Export supabase clients for use in other modules
export { supabase, supabaseAdmin, supabaseUser };

export class DatabaseClient implements IDatabaseClient {
  async getWorkWithVoiceActors(contentId: number) {
    debugLog("Fetching work with voice actors", { contentId });

    const { data, error } = await supabaseAdmin.from("work")
      .select(`*, voiceActorDetails:voice_actors (*)`)
      .eq("content_id", contentId);

    if (error) {
      debugLog("Error fetching work with voice actors", { error: error.message });
      throw error;
    }

    debugLog("Work data retrieved", { count: data?.length || 0, sample: data?.[0] });

    return data;
  }

  async getVoiceActorWithWork(voiceActorId: number) {
    debugLog("Fetching voice actor with work", { voiceActorId });

    const { data, error } = await supabase.from("voice_actors")
      .select(`*, work (*)`)
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
    const { data, error } = await supabase
      .from("work")
      .select(`
        *,
        voice_actors (*)
      `)
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
    // Get vote counts for the specified work entries
    const { data: votes, error } = await supabase
      .from("votes")
      .select("work_id, vote_type")
      .in("work_id", workIds);

    if (error) throw error;

    // Get user's specific votes if userId provided
    let userVotes: any[] = [];
    if (userId) {
      const { data: userVotesData, error: userVotesError } = await supabase
        .from("votes")
        .select("work_id, vote_type")
        .eq("user_id", userId)
        .in("work_id", workIds);

      if (userVotesError) throw userVotesError;
      userVotes = userVotesData || [];
    }

    // Aggregate vote counts
    const voteCounts: Record<
      number,
      { up_count: number; down_count: number; user_vote: string | null }
    > = {};

    // Initialize with zero counts
    workIds.forEach((workId) => {
      voteCounts[workId] = { up_count: 0, down_count: 0, user_vote: null };
    });

    // Count all votes
    votes.forEach((vote) => {
      if (vote.vote_type === "up") {
        voteCounts[vote.work_id].up_count++;
      } else if (vote.vote_type === "down") {
        voteCounts[vote.work_id].down_count++;
      }
    });

    // Set user's vote
    userVotes.forEach((vote) => {
      voteCounts[vote.work_id].user_vote = vote.vote_type;
    });

    return voteCounts;
  }
}
