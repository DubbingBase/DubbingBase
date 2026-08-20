import { ref } from "vue";
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
  trendingVoiceActors: any[];
  errorMovies: string;
  errorSeries: string;
  errorGames: string;
  errorVoiceActors: string;
  errorTopVoiceActors: string;
  errorTrendingVoiceActors: string;
  topContributors: any[];
  errorTopContributors: string;
  homeStats: {
    voiceActorCount: number;
    dubbingProjectCount: number;
    workCount: number;
  };
  errorHomeStats: string;
};

export async function fetchHomeData(): Promise<HomeDataPayload> {
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
    $fetch<any>("/api/trending/movies")
      .then((res) => {
        payload.trendingMovies = res.results || [];
      })
      .catch((e) => {
        payload.errorMovies =
          e.data?.message ||
          e.message ||
          "Erreur lors du chargement des films.";
      }),

    $fetch<any>("/api/trending/shows")
      .then((res) => {
        payload.trendingSeries = res.results || [];
      })
      .catch((e) => {
        payload.errorSeries =
          e.data?.message ||
          e.message ||
          "Erreur lors du chargement des séries.";
      }),

    $fetch<any>("/api/trending/games")
      .then((res) => {
        payload.trendingGames = res || [];
      })
      .catch((e) => {
        payload.errorGames =
          e.data?.message || e.message || "Erreur lors du chargement des jeux.";
      }),

    $fetch<any>("/api/recent-voice-actors", { params: { limit: 10 } })
      .then((res) => {
        payload.recentVoiceActors = res || [];
      })
      .catch((e) => {
        payload.errorVoiceActors =
          e.data?.message ||
          e.message ||
          "Erreur lors du chargement des voix récentes.";
      }),

    $fetch<any>("/api/top-voice-actors", { params: { limit: 10 } })
      .then((res) => {
        payload.topVoiceActors = res || [];
      })
      .catch((e) => {
        payload.errorTopVoiceActors =
          e.data?.message ||
          e.message ||
          "Erreur lors du chargement des top doubleurs.";
      }),

    $fetch<any>("/api/trending/voice-actors")
      .then((res) => {
        payload.trendingVoiceActors = res || [];
      })
      .catch((e) => {
        payload.errorTrendingVoiceActors =
          e.data?.message ||
          e.message ||
          "Erreur lors du chargement des doubleurs du moment.";
      }),

    $fetch<any>("/api/top-contributors", { params: { limit: 10 } })
      .then((res) => {
        payload.topContributors = res || [];
      })
      .catch((e) => {
        payload.errorTopContributors =
          e.data?.message ||
          e.message ||
          "Erreur lors du chargement des contributeurs.";
      }),

    $fetch<any>("/api/home-stats")
      .then((res) => {
        payload.homeStats = res || {
          voiceActorCount: 0,
          dubbingProjectCount: 0,
          workCount: 0,
        };
      })
      .catch((e) => {
        payload.errorHomeStats =
          e.data?.message ||
          e.message ||
          "Erreur lors du chargement des statistiques.";
      }),
  ]);

  return payload;
}

export function useHomeData(initialData?: HomeDataPayload | null) {
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
  const trendingVoiceActors = ref<any[]>(
    initialData?.trendingVoiceActors || [],
  );
  const topContributors = ref<any[]>(initialData?.topContributors || []);
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
  const errorTrendingVoiceActors = ref(
    initialData?.errorTrendingVoiceActors || "",
  );
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
