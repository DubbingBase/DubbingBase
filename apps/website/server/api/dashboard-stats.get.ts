import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";
import { requireAdmin } from "../utils/auth";

interface DashboardStats {
  userCount: number;
  voiceActorCount: number;
  userGrowth: { date: string; count: number }[];
  voiceActorGrowth: { date: string; count: number }[];
  topVoiceActors: any[];
}

async function getUserCount(): Promise<number> {
  const supabaseAdmin = useSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw error;
  return data.users?.length || 0;
}

async function getVoiceActorCount(): Promise<number> {
  const supabase = useSupabaseAdmin();
  const { count, error } = await supabase
    .from("voice_actors")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
}

async function getUserGrowth(): Promise<{ date: string; count: number }[]> {
  const supabaseAdmin = useSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw error;

  const grouped = (data.users || [])
    .filter((user: any) => user.is_anonymous === false)
    .reduce(
      (acc: Record<string, number>, user: any) => {
        const date =
          new Date(user.created_at).toISOString().split("T")[0] || "";
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count: count as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getVoiceActorGrowth(): Promise<
  { date: string; count: number }[]
> {
  const supabase = useSupabaseAdmin();
  const PAGE_SIZE = 1000;
  let from = 0;
  let allData: { created_at: string | null }[] = [];
  let hasMore = true;

  // Paginate to avoid OOM on large tables
  while (hasMore) {
    const { data, error } = await supabase
      .from("voice_actors")
      .select("created_at")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  const grouped = allData.reduce(
    (acc: Record<string, number>, va: any) => {
      const d = va?.created_at;
      const a = d ? new Date(d) : new Date();
      const date = a.toISOString().split("T")[0] || "";
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count: count as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getTopVoiceActors(limit = 10): Promise<any[]> {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_top_voice_actors", {
    limit_param: limit,
  });

  if (error) throw error;

  return (data || []).map((result: any) => ({
    ...result.voice_actor,
    role_count: result.role_count,
    profile_picture: buildSupabaseImageUrl(result.voice_actor?.profile_picture),
  }));
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);

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

    return data;
  } catch (error) {
    console.error("Error in dashboard-stats route:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
