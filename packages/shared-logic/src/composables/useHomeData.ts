import { ref } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IgdbGame,
  MovieTrendingResponse,
  SerieTrendingResponse,
  Tables,
} from "../types";

export type HomeDataPayload = {
  trendingMovies: MovieTrendingResponse["results"];
  trendingSeries: SerieTrendingResponse["results"];
  trendingGames: IgdbGame[];
  recentVoiceActors: Tables<"voice_actors">[];
  topVoiceActors: Tables<"voice_actors">[];
  errorMovies: string;
  errorSeries: string;
  errorGames: string;
  errorVoiceActors: string;
  errorTopVoiceActors: string;
  topContributors: any[];
  errorTopContributors: string;
};

export async function fetchHomeData(
  supabase: SupabaseClient,
): Promise<HomeDataPayload> {
  const payload: HomeDataPayload = {
    trendingMovies: [],
    trendingSeries: [],
    trendingGames: [],
    recentVoiceActors: [],
    topVoiceActors: [],
    errorMovies: "",
    errorSeries: "",
    errorGames: "",
    errorVoiceActors: "",
    errorTopVoiceActors: "",
    topContributors: [],
    errorTopContributors: "",
  };

  await Promise.allSettled([
    // Fetch movies in parallel
    supabase.functions
      .invoke("trending-movies")
      .then((res) => {
        if (res.error) throw new Error(res.error.message || "Erreur inconnue");
        payload.trendingMovies = res.data.results || [];
      })
      .catch((e) => {
        payload.errorMovies =
          e.message || "Erreur lors du chargement des films.";
      }),

    // Fetch series in parallel
    supabase.functions
      .invoke("trending-shows")
      .then((res) => {
        if (res.error) throw new Error(res.error.message || "Erreur inconnue");
        payload.trendingSeries = res.data.results || [];
      })
      .catch((e) => {
        payload.errorSeries =
          e.message || "Erreur lors du chargement des séries.";
      }),

    // Fetch games in parallel
    supabase.functions
      .invoke("trending-games")
      .then((res) => {
        if (res.error) throw new Error(res.error.message || "Erreur inconnue");
        payload.trendingGames = res.data || [];
      })
      .catch((e) => {
        payload.errorGames = e.message || "Erreur lors du chargement des jeux.";
      }),

    // Fetch recent voice actors in parallel
    supabase.functions
      .invoke("recent-voice-actors", { body: { limit: 10 } })
      .then((res) => {
        if (res.error) throw new Error(res.error.message || "Erreur inconnue");
        payload.recentVoiceActors = res.data || [];
      })
      .catch((e) => {
        payload.errorVoiceActors =
          e.message || "Erreur lors du chargement des voix récentes.";
      }),

    // Fetch top voice actors in parallel
    supabase.functions
      .invoke("top-voice-actors", { body: { limit: 10 } })
      .then((res) => {
        if (res.error) throw new Error(res.error.message || "Erreur inconnue");
        payload.topVoiceActors = res.data || [];
      })
      .catch((e) => {
        payload.errorTopVoiceActors =
          e.message || "Erreur lors du chargement des top doubleurs.";
      }),

    // Fetch top contributors in parallel
    supabase.functions
      .invoke("top-contributors", { body: { limit: 10 } })
      .then((res) => {
        if (res.error) throw new Error(res.error.message || "Erreur inconnue");
        payload.topContributors = res.data || [];
      })
      .catch((e) => {
        payload.errorTopContributors =
          e.message || "Erreur lors du chargement des contributeurs.";
      }),
  ]);

  return payload;
}

export function useHomeData(
  supabase: SupabaseClient,
  initialData?: HomeDataPayload | null,
) {
  const trendingMovies = ref<MovieTrendingResponse["results"]>(
    initialData?.trendingMovies || [],
  );
  const trendingSeries = ref<SerieTrendingResponse["results"]>(
    initialData?.trendingSeries || [],
  );
  const trendingGames = ref<IgdbGame[]>(initialData?.trendingGames || []);
  const recentVoiceActors = ref<Tables<"voice_actors">[]>(
    initialData?.recentVoiceActors || [],
  );
  const topVoiceActors = ref<Tables<"voice_actors">[]>(
    initialData?.topVoiceActors || [],
  );
  const topContributors = ref<any[]>(initialData?.topContributors || []);

  const isLoadingMovies = ref(!initialData);
  const isLoadingSeries = ref(!initialData);
  const isLoadingGames = ref(!initialData);
  const isLoadingVoiceActors = ref(!initialData);
  const isLoadingTopVoiceActors = ref(!initialData);
  const isLoadingTopContributors = ref(!initialData);

  const errorMovies = ref(initialData?.errorMovies || "");
  const errorSeries = ref(initialData?.errorSeries || "");
  const errorGames = ref(initialData?.errorGames || "");
  const errorVoiceActors = ref(initialData?.errorVoiceActors || "");
  const errorTopVoiceActors = ref(initialData?.errorTopVoiceActors || "");
  const errorTopContributors = ref(initialData?.errorTopContributors || "");

  const loadHomeData = async () => {
    isLoadingMovies.value = true;
    isLoadingSeries.value = true;
    isLoadingGames.value = true;
    isLoadingVoiceActors.value = true;
    isLoadingTopVoiceActors.value = true;

    errorMovies.value = "";
    errorSeries.value = "";
    errorGames.value = "";
    errorVoiceActors.value = "";
    errorTopVoiceActors.value = "";
    errorTopContributors.value = "";

    const payload = await fetchHomeData(supabase);

    trendingMovies.value = payload.trendingMovies;
    errorMovies.value = payload.errorMovies;
    isLoadingMovies.value = false;

    trendingSeries.value = payload.trendingSeries;
    errorSeries.value = payload.errorSeries;
    isLoadingSeries.value = false;

    trendingGames.value = payload.trendingGames;
    errorGames.value = payload.errorGames;
    isLoadingGames.value = false;

    recentVoiceActors.value = payload.recentVoiceActors;
    errorVoiceActors.value = payload.errorVoiceActors;
    isLoadingVoiceActors.value = false;

    topVoiceActors.value = payload.topVoiceActors;
    errorTopVoiceActors.value = payload.errorTopVoiceActors;
    isLoadingTopVoiceActors.value = false;

    topContributors.value = payload.topContributors;
    errorTopContributors.value = payload.errorTopContributors;
    isLoadingTopContributors.value = false;
  };

  return {
    trendingMovies,
    trendingSeries,
    trendingGames,
    recentVoiceActors,
    topVoiceActors,
    topContributors,
    isLoadingMovies,
    isLoadingSeries,
    isLoadingGames,
    isLoadingVoiceActors,
    isLoadingTopVoiceActors,
    isLoadingTopContributors,
    errorMovies,
    errorSeries,
    errorGames,
    errorVoiceActors,
    errorTopVoiceActors,
    errorTopContributors,
    loadHomeData,
  };
}
