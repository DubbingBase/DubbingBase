import {
  createErrorResponse,
  createResponse,
  handleOptions,
} from "../_shared/http-utils.ts";
import { supabase, supabaseAdmin } from "../_shared/database.ts";
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";

interface DashboardStats {
  userCount: number;
  voiceActorCount: number;
  userGrowth: { date: string; count: number }[];
  voiceActorGrowth: { date: string; count: number }[];
  topVoiceActors: any[];
}

async function getUserCount(): Promise<number> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) throw error;
  return data.total || 0;
}

async function getVoiceActorCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("voice_actors")
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  return count || 0;
}

async function getUserGrowth(): Promise<{ date: string; count: number }[]> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) throw error;

  const grouped = (data.users || [])
    .filter((user) => user.is_anonymous === false)
    .reduce((acc, user) => {
      const date = new Date(user.created_at).toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count: count as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getVoiceActorGrowth(): Promise<
  { date: string; count: number }[]
> {
  const { data, error } = await supabaseAdmin
    .from("voice_actors")
    // .select("created_at")
    // .order("created_at");
    .select("*");

  if (error) throw error;

  // console.log("data", data);

  const grouped = (data || []).reduce((acc, va) => {
    const d = va?.created_at;
    const a = d ? new Date(d) : new Date();
    console.log("a", a);
    const date = a.toISOString().split("T")[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count: count as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getTopVoiceActors(limit = 10): Promise<any[]> {
  const { data, error } = await supabase.rpc("get_top_voice_actors", {
    limit_param: limit,
  });

  if (error) throw error;

  return (data || []).map((result) => ({
    ...result.voice_actor,
    role_count: result.role_count,
    profile_picture: buildSupabaseImageUrl(
      result.voice_actor.profile_picture,
      "voice_actor_profile_pictures",
      "500",
    ),
  }));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  try {
    const [
      userCount,
      voiceActorCount,
      userGrowth,
      voiceActorGrowth,
      topVoiceActors,
    ] = await Promise.all([
      getUserCount(),
      getVoiceActorCount(),
      getUserGrowth(),
      getVoiceActorGrowth(),
      getTopVoiceActors(10),
    ]);

    const data: DashboardStats = {
      userCount,
      voiceActorCount,
      userGrowth,
      voiceActorGrowth,
      topVoiceActors,
    };

    return createResponse(data);
  } catch (error) {
    console.error("Error in dashboard-stats function:", error);
    return createErrorResponse("Internal server error");
  }
});
