import { ref } from "vue";
import type { IgdbGame, MovieTrendingResponse, SerieTrendingResponse, Tables } from "../types";
import { readPath, readProperty } from "../utils/narrow";

export type HomeDataPayload = {
  trendingMovies: MovieTrendingResponse["results"];
  trendingSeries: SerieTrendingResponse["results"];
  trendingGames: IgdbGame[];
  recentVoiceActors: Tables<"voice_actors">[];
  topVoiceActors: Tables<"voice_actors">[];
  trendingVoiceActors: TrendingVoiceActorSummary[];
  errorMovies: string;
  errorSeries: string;
  errorGames: string;
  errorVoiceActors: string;
  errorTopVoiceActors: string;
  errorTrendingVoiceActors: string;
  topContributors: TopContributorSummary[];
  errorTopContributors: string;
  homeStats: {
    voiceActorCount: number;
    dubbingProjectCount: number;
    workCount: number;
  };
  errorHomeStats: string;
};

export type TrendingVoiceActorSummary = {
  id: number;
  firstname: string;
  lastname: string;
  work_count: number;
  profile_picture: string | null;
};

export type TopContributorSummary = {
  user_id: string;
  score: number;
  raw_user_meta_data: {
    username?: string;
    avatar_url?: string;
  };
};

type HomeStats = HomeDataPayload["homeStats"];

/** Message of a failed `$fetch`: the API error body's `message`, else the error's own message. */
function fetchErrorMessage(error: unknown, fallback: string): string {
  const apiMessage = readPath(error, "data", "message");
  if (typeof apiMessage === "string" && apiMessage) return apiMessage;
  const message = readProperty(error, "message");
  if (typeof message === "string" && message) return message;
  return fallback;
}

export async function fetchHomeData(language = "en-US"): Promise<HomeDataPayload> {
  const payload: HomeDataPayload = {
    trendingMovies: [],
    trendingSeries: [],
    trendingGames: [],
    recentVoiceActors: [],
    topVoiceActors: [],
    trendingVoiceActors: [],
    errorMovies: "",
    errorSeries: "",
    errorGames: "",
    errorVoiceActors: "",
    errorTopVoiceActors: "",
    errorTrendingVoiceActors: "",
    topContributors: [],
    errorTopContributors: "",
    homeStats: {
      voiceActorCount: 0,
      dubbingProjectCount: 0,
      workCount: 0,
    },
    errorHomeStats: "",
  };

  await Promise.allSettled([
    $fetch<MovieTrendingResponse>("/api/trending/movies", { query: { lang: language } })
      .then((res) => {
        payload.trendingMovies = res.results || [];
      })
      .catch((e: unknown) => {
        payload.errorMovies = fetchErrorMessage(e, "Erreur lors du chargement des films.");
      }),

    $fetch<SerieTrendingResponse>("/api/trending/shows", { query: { lang: language } })
      .then((res) => {
        payload.trendingSeries = res.results || [];
      })
      .catch((e: unknown) => {
        payload.errorSeries = fetchErrorMessage(e, "Erreur lors du chargement des séries.");
      }),

    $fetch<IgdbGame[]>("/api/trending/games", { query: { lang: language } })
      .then((res) => {
        payload.trendingGames = res || [];
      })
      .catch((e: unknown) => {
        payload.errorGames = fetchErrorMessage(e, "Erreur lors du chargement des jeux.");
      }),

    $fetch<Tables<"voice_actors">[]>("/api/recent-voice-actors", { query: { limit: 10 } })
      .then((res) => {
        payload.recentVoiceActors = res || [];
      })
      .catch((e: unknown) => {
        payload.errorVoiceActors = fetchErrorMessage(
          e,
          "Erreur lors du chargement des voix récentes.",
        );
      }),

    $fetch<Tables<"voice_actors">[]>("/api/top-voice-actors", { query: { limit: 10 } })
      .then((res) => {
        payload.topVoiceActors = res || [];
      })
      .catch((e: unknown) => {
        payload.errorTopVoiceActors = fetchErrorMessage(
          e,
          "Erreur lors du chargement des top doubleurs.",
        );
      }),

    $fetch<TrendingVoiceActorSummary[]>("/api/trending/voice-actors", {
      query: { projection: "home" },
    })
      .then((res) => {
        payload.trendingVoiceActors = res || [];
      })
      .catch((e: unknown) => {
        payload.errorTrendingVoiceActors = fetchErrorMessage(
          e,
          "Erreur lors du chargement des doubleurs du moment.",
        );
      }),

    $fetch<TopContributorSummary[]>("/api/top-contributors", {
      query: { limit: 10, projection: "home" },
    })
      .then((res) => {
        payload.topContributors = res || [];
      })
      .catch((e: unknown) => {
        payload.errorTopContributors = fetchErrorMessage(
          e,
          "Erreur lors du chargement des contributeurs.",
        );
      }),

    $fetch<HomeStats>("/api/home-stats")
      .then((res) => {
        payload.homeStats = res || {
          voiceActorCount: 0,
          dubbingProjectCount: 0,
          workCount: 0,
        };
      })
      .catch((e: unknown) => {
        payload.errorHomeStats = fetchErrorMessage(
          e,
          "Erreur lors du chargement des statistiques.",
        );
      }),
  ]);

  return payload;
}

export function useHomeData(initialData?: HomeDataPayload | null) {
  const trendingMovies = ref<MovieTrendingResponse["results"]>(initialData?.trendingMovies || []);
  const trendingSeries = ref<SerieTrendingResponse["results"]>(initialData?.trendingSeries || []);
  const trendingGames = ref<IgdbGame[]>(initialData?.trendingGames || []);
  const recentVoiceActors = ref<Tables<"voice_actors">[]>(initialData?.recentVoiceActors || []);
  const topVoiceActors = ref<Tables<"voice_actors">[]>(initialData?.topVoiceActors || []);
  const trendingVoiceActors = ref<TrendingVoiceActorSummary[]>(
    initialData?.trendingVoiceActors || [],
  );
  const topContributors = ref<TopContributorSummary[]>(initialData?.topContributors || []);
  const homeStats = ref<{
    voiceActorCount: number;
    dubbingProjectCount: number;
    workCount: number;
  }>(
    initialData?.homeStats || {
      voiceActorCount: 0,
      dubbingProjectCount: 0,
      workCount: 0,
    },
  );

  const isLoadingMovies = ref(!initialData);
  const isLoadingSeries = ref(!initialData);
  const isLoadingGames = ref(!initialData);
  const isLoadingVoiceActors = ref(!initialData);
  const isLoadingTopVoiceActors = ref(!initialData);
  const isLoadingTrendingVoiceActors = ref(!initialData);
  const isLoadingTopContributors = ref(!initialData);
  const isLoadingHomeStats = ref(!initialData);

  const errorMovies = ref(initialData?.errorMovies || "");
  const errorSeries = ref(initialData?.errorSeries || "");
  const errorGames = ref(initialData?.errorGames || "");
  const errorVoiceActors = ref(initialData?.errorVoiceActors || "");
  const errorTopVoiceActors = ref(initialData?.errorTopVoiceActors || "");
  const errorTrendingVoiceActors = ref(initialData?.errorTrendingVoiceActors || "");
  const errorTopContributors = ref(initialData?.errorTopContributors || "");
  const errorHomeStats = ref(initialData?.errorHomeStats || "");

  const loadHomeData = async () => {
    isLoadingMovies.value = true;
    isLoadingSeries.value = true;
    isLoadingGames.value = true;
    isLoadingVoiceActors.value = true;
    isLoadingTopVoiceActors.value = true;
    isLoadingTopContributors.value = true;
    isLoadingHomeStats.value = true;
    isLoadingTrendingVoiceActors.value = true;

    errorMovies.value = "";
    errorSeries.value = "";
    errorGames.value = "";
    errorVoiceActors.value = "";
    errorTopVoiceActors.value = "";
    errorTrendingVoiceActors.value = "";
    errorTopContributors.value = "";
    errorHomeStats.value = "";

    const payload = await fetchHomeData();

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

    trendingVoiceActors.value = payload.trendingVoiceActors;
    errorTrendingVoiceActors.value = payload.errorTrendingVoiceActors;
    isLoadingTrendingVoiceActors.value = false;

    topContributors.value = payload.topContributors;
    errorTopContributors.value = payload.errorTopContributors;
    isLoadingTopContributors.value = false;

    homeStats.value = payload.homeStats;
    errorHomeStats.value = payload.errorHomeStats;
    isLoadingHomeStats.value = false;
  };

  return {
    trendingMovies,
    trendingSeries,
    trendingGames,
    recentVoiceActors,
    topVoiceActors,
    trendingVoiceActors,
    topContributors,
    homeStats,
    isLoadingMovies,
    isLoadingSeries,
    isLoadingGames,
    isLoadingVoiceActors,
    isLoadingTopVoiceActors,
    isLoadingTrendingVoiceActors,
    isLoadingTopContributors,
    isLoadingHomeStats,
    errorMovies,
    errorSeries,
    errorGames,
    errorVoiceActors,
    errorTopVoiceActors,
    errorTrendingVoiceActors,
    errorTopContributors,
    errorHomeStats,
    loadHomeData,
  };
}
