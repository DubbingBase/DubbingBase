import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";
import { defineAdminHandler } from "../utils/auth-handlers";
interface DashboardStats {
  userCount: number;
  voiceActorCount: number;
  userGrowth: { date: string; count: number }[];
  voiceActorGrowth: { date: string; count: number }[];
  topVoiceActors: Record<string, unknown>[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countByDay(dates: Iterable<string | null | undefined>) {
  const grouped = new Map<string, number>();
  for (const value of dates) {
    const date = (value ? new Date(value) : new Date()).toISOString().split("T")[0] || "";
    grouped.set(date, (grouped.get(date) || 0) + 1);
  }

  return [...grouped]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
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

  return countByDay(
    (data.users || []).filter((user) => user.is_anonymous === false).map((user) => user.created_at),
  );
}

async function getVoiceActorGrowth(): Promise<{ date: string; count: number }[]> {
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

  return countByDay(allData.map((va) => va.created_at));
}

async function getTopVoiceActors(limit = 10): Promise<Record<string, unknown>[]> {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_top_voice_actors", {
    limit_param: limit,
  });

  if (error) throw error;

  return (data || []).map((result) => {
    const voiceActor = isRecord(result.voice_actor) ? result.voice_actor : {};
    const profilePicture = voiceActor.profile_picture;
    return {
      ...voiceActor,
      role_count: result.role_count,
      profile_picture: buildSupabaseImageUrl(
        typeof profilePicture === "string" ? profilePicture : null,
      ),
    };
  });
}

export default defineAdminHandler(async () => {
  try {
    const [userCount, voiceActorCount, userGrowth, voiceActorGrowth, topVoiceActors] =
      await Promise.all([
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
