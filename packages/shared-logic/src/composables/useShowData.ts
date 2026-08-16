import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ShowResponse,
  SeasonResponse,
  EpisodeResponse,
} from "@supabase/functions/_shared/types";

export async function fetchShowData(
  supabase: SupabaseClient,
  id: string | number,
  locale?: string,
): Promise<ShowResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  const showResponseRaw = await supabase.functions.invoke<ShowResponse>(
    "show",
    {
      body: { id },
      headers,
    },
  );

  const data = showResponseRaw.data;
  if (!data) {
    console.error("fetchShowData: Response is null", showResponseRaw);
    return null;
  }

  return data;
}

export async function fetchSeasonData(
  supabase: any,
  id: string | number | undefined,
  seasonNumber: number,
  locale?: string,
): Promise<SeasonResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  const seasonResponseRaw = await supabase.functions.invoke("season", {
    body: { id, season_number: seasonNumber },
    headers,
  });

  const data: SeasonResponse | null = seasonResponseRaw?.data ?? null;
  if (!data) {
    console.error("fetchSeasonData: Response is null", seasonResponseRaw);
    return null;
  }

  return data;
}

export async function fetchEpisodeData(
  supabase: any,
  id: string | number | undefined,
  seasonNumber: number,
  episodeNumber: number,
  locale?: string,
): Promise<EpisodeResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  const episodeResponseRaw = await supabase.functions.invoke("episode", {
    body: { id, season_number: seasonNumber, episode_number: episodeNumber },
    headers,
  });

  const data: EpisodeResponse | null = episodeResponseRaw?.data ?? null;
  if (!data) {
    console.error("fetchEpisodeData: Response is null", episodeResponseRaw);
    return null;
  }

  return data;
}
