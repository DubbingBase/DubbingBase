import {
  createErrorResponse,
  createResponse,
  handleOptions,
} from "../_shared/http-utils.ts";
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";
import { SupabaseContext, withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

interface DashboardStats {
  userCount: number;
  voiceActorCount: number;
  userGrowth: { date: string; count: number }[];
  voiceActorGrowth: { date: string; count: number }[];
  topVoiceActors: any[];
}

async function getUserCount(ctx: SupabaseContext<Database>): Promise<number> {
  const { data, error } = await ctx.supabaseAdmin.auth.admin.listUsers();

  if (error) throw error;
  return data.total || 0;
}

async function getVoiceActorCount(
  ctx: SupabaseContext<Database>,
): Promise<number> {
  const { count, error } = await ctx.supabaseAdmin
    .from("voice_actors")
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  return count || 0;
}

async function getUserGrowth(
  ctx: SupabaseContext<Database>,
): Promise<{ date: string; count: number }[]> {
  const { data, error } = await ctx.supabaseAdmin.auth.admin.listUsers();

  if (error) throw error;

  const grouped = (data.users || [])
    .filter((user) => user.is_anonymous === false)
    .reduce(
      (acc, user) => {
        const date = new Date(user.created_at).toISOString().split("T")[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count: count as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getVoiceActorGrowth(
  ctx: SupabaseContext<Database>,
): Promise<{ date: string; count: number }[]> {
  let allData: any[] = [];
  let from = 0;
  const chunkSize = 1000;

  while (true) {
    const { data, error } = await ctx.supabaseAdmin
      .from("voice_actors")
      .select("created_at")
      .range(from, from + chunkSize - 1);

    if (error) throw error;

    allData = allData.concat(data);

    if (data.length < chunkSize) break;

    from += chunkSize;
  }

  const grouped = (allData || []).reduce(
    (acc, va) => {
      const d = va?.created_at;
      const a = d ? new Date(d) : new Date();
      const date = a.toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count: count as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getTopVoiceActors(
  ctx: SupabaseContext<Database>,
  limit = 10,
): Promise<any[]> {
  const { data, error } = await ctx.supabase.rpc("get_top_voice_actors", {
    limit_param: limit,
  });

  if (error) throw error;

  return (data || []).map((result: any) => ({
    ...result.voice_actor,
    role_count: result.role_count,
    profile_picture: buildSupabaseImageUrl(
      ctx,
      result.voice_actor.profile_picture,
      "voice_actor_profile_pictures",
      "500",
    ),
  }));
}

export default {
  fetch: withSupabase<Database>({ auth: "publishable:*" }, async (req, ctx) => {
    try {
      const [
        userCount,
        voiceActorCount,
        userGrowth,
        voiceActorGrowth,
        topVoiceActors,
      ] = await Promise.all([
        getUserCount(ctx),
        getVoiceActorCount(ctx),
        getUserGrowth(ctx),
        getVoiceActorGrowth(ctx),
        getTopVoiceActors(ctx, 10),
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
  }),
};
