import { ref } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { 
  MovieTrendingResponse, 
  SerieTrendingResponse, 
  Tables 
} from "../types";

export function useHomeData(supabase: SupabaseClient) {
  const trendingMovies = ref<MovieTrendingResponse["results"]>([]);
  const trendingSeries = ref<SerieTrendingResponse["results"]>([]);
  const recentVoiceActors = ref<Tables<"voice_actors">[]>([]);
  const topVoiceActors = ref<Tables<"voice_actors">[]>([]);
  
  const isLoadingMovies = ref(true);
  const isLoadingSeries = ref(true);
  const isLoadingVoiceActors = ref(true);
  const isLoadingTopVoiceActors = ref(true);
  
  const errorMovies = ref("");
  const errorSeries = ref("");
  const errorVoiceActors = ref("");
  const errorTopVoiceActors = ref("");

  const loadHomeData = async () => {
    isLoadingMovies.value = true;
    isLoadingSeries.value = true;
    isLoadingVoiceActors.value = true;
    isLoadingTopVoiceActors.value = true;
    
    errorMovies.value = "";
    errorSeries.value = "";
    errorVoiceActors.value = "";
    errorTopVoiceActors.value = "";

    await Promise.allSettled([
      // Fetch movies in parallel
      supabase.functions
        .invoke("trending-movies")
        .then((res) => {
          if (res.error) throw new Error(res.error.message || "Erreur inconnue");
          trendingMovies.value = res.data.results || [];
        })
        .catch((e) => {
          errorMovies.value = e.message || "Erreur lors du chargement des films.";
          trendingMovies.value = [];
        })
        .finally(() => {
          isLoadingMovies.value = false;
        }),

      // Fetch series in parallel
      supabase.functions
        .invoke("trending-shows")
        .then((res) => {
          if (res.error) throw new Error(res.error.message || "Erreur inconnue");
          trendingSeries.value = res.data.results || [];
        })
        .catch((e) => {
          errorSeries.value =
            e.message || "Erreur lors du chargement des séries.";
          trendingSeries.value = [];
        })
        .finally(() => {
          isLoadingSeries.value = false;
        }),

      // Fetch recent voice actors in parallel
      supabase.functions
        .invoke("recent-voice-actors", { body: { limit: 10 } })
        .then((res) => {
          if (res.error) throw new Error(res.error.message || "Erreur inconnue");
          recentVoiceActors.value = res.data || [];
        })
        .catch((e) => {
          errorVoiceActors.value =
            e.message || "Erreur lors du chargement des voix récentes.";
          recentVoiceActors.value = [];
        })
        .finally(() => {
          isLoadingVoiceActors.value = false;
        }),

      // Fetch top voice actors in parallel
      supabase.functions
        .invoke("top-voice-actors", { body: { limit: 10 } })
        .then((res) => {
          if (res.error) throw new Error(res.error.message || "Erreur inconnue");
          topVoiceActors.value = res.data || [];
        })
        .catch((e) => {
          errorTopVoiceActors.value =
            e.message || "Erreur lors du chargement des top doubleurs.";
          topVoiceActors.value = [];
        })
        .finally(() => {
          isLoadingTopVoiceActors.value = false;
        }),
    ]);
  };

  return {
    trendingMovies,
    trendingSeries,
    recentVoiceActors,
    topVoiceActors,
    isLoadingMovies,
    isLoadingSeries,
    isLoadingVoiceActors,
    isLoadingTopVoiceActors,
    errorMovies,
    errorSeries,
    errorVoiceActors,
    errorTopVoiceActors,
    loadHomeData
  };
}
