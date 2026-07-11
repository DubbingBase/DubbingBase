<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ t('navigation.home') }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">{{ t('home.welcome') }}</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="trending-movies">
        <div class="list-header">{{ t('home.trendingMovies') }}</div>
        <div class="movies">
          <template v-if="isLoadingMovies">
            <MediaItem
              v-for="i in 3"
              :key="'movie-skeleton-' + i"
              :loading="true"
              imagePath=""
              title=""
              routeName=""
              :routeParams="{}"
            />
          </template>
          <template v-else-if="errorMovies">
            <div class="error-message">{{ t('home.moviesError') }}</div>
          </template>
          <template v-else-if="trendingMovies.length === 0">
            <div class="empty-message">{{ t('home.moviesEmpty') }}</div>
          </template>
          <template v-else>
            <MediaItem
              :key="movie.id"
              v-for="movie in trendingMovies"
              :imagePath="movie.poster_path"
              :title="movie.title"
              routeName="MovieDetails"
              :routeParams="{ id: movie.id }"
            ></MediaItem>
          </template>
        </div>
      </div>
      <div class="trending-series">
        <div class="list-header">{{ t('home.trendingSeries') }}</div>
        <div class="series">
          <template v-if="isLoadingSeries">
            <MediaItem
              v-for="i in 3"
              :key="'series-skeleton-' + i"
              :loading="true"
              imagePath=""
              title=""
              routeName=""
              :routeParams="{}"
            />
          </template>
          <template v-else-if="errorSeries">
            <div class="error-message">{{ t('home.seriesError') }}</div>
          </template>
          <template v-else-if="trendingSeries.length === 0">
            <div class="empty-message">{{ t('home.seriesEmpty') }}</div>
          </template>
          <template v-else>
            <MediaItem
              :key="show.id"
              v-for="show in trendingSeries"
              :imagePath="show.poster_path"
              :title="show.name"
              routeName="SerieDetails"
              :routeParams="{ id: show.id }"
            ></MediaItem>
          </template>
        </div>
      </div>
      <div class="recent-voice-actors">
        <div class="list-header">{{ t('home.recentVoiceActors') }}</div>
        <div class="voice-actors">
          <template v-if="isLoadingVoiceActors">
            <MediaItem
              v-for="i in 3"
              :key="'voice-actor-skeleton-' + i"
              :loading="true"
              imagePath=""
              title=""
              routeName=""
              :routeParams="{}"
            />
          </template>
          <template v-else-if="errorVoiceActors">
            <div class="error-message">{{ t('home.voiceActorsError') }}</div>
          </template>
          <template v-else-if="recentVoiceActors.length === 0">
            <div class="empty-message">{{ t('home.voiceActorsEmpty') }}</div>
          </template>
          <template v-else>
            <MediaItem
              :key="va.id"
              v-for="va in recentVoiceActors"
              :imagePath="va.profile_picture ?? undefined"
              :title="`${va.firstname} ${va.lastname}`"
              routeName="VoiceActorDetails"
              :routeParams="{ id: va.id }"
              :fallbackImagePath="`https://api.dicebear.com/9.x/initials/svg?scale=50&backgroundColor=212121&seed=${va.firstname} ${va.lastname}`"
            ></MediaItem>
          </template>
        </div>
      </div>
      <div class="top-voice-actors">
        <div class="list-header">{{ t('home.topVoiceActors') }}</div>
        <div class="voice-actors">
          <template v-if="isLoadingTopVoiceActors">
            <MediaItem
              v-for="i in 3"
              :key="'top-voice-actor-skeleton-' + i"
              :loading="true"
              imagePath=""
              title=""
              routeName=""
              :routeParams="{}"
            />
          </template>
          <template v-else-if="errorTopVoiceActors">
            <div class="error-message">{{ t('home.topVoiceActorsError') }}</div>
          </template>
          <template v-else-if="topVoiceActors.length === 0">
            <div class="empty-message">{{ t('home.topVoiceActorsEmpty') }}</div>
          </template>
          <template v-else>
            <MediaItem
              :key="va.id"
              v-for="va in topVoiceActors"
              :imagePath="va.profile_picture ?? undefined"
              :title="`${va.firstname} ${va.lastname}`"
              routeName="VoiceActorDetails"
              :routeParams="{ id: va.id }"
              :fallbackImagePath="`https://api.dicebear.com/9.x/initials/svg?scale=50&backgroundColor=212121&seed=${va.firstname} ${va.lastname}`"
            ></MediaItem>
          </template>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { TrendingResponse } from "@supabase/functions/_shared/movie";
import type { TrendingResponse as SerieTrendingResponse } from "@supabase/functions/_shared/serie";
import type { Tables } from "@/utils/database";
import MediaItem from "../components/MediaItem.vue";
import { supabase } from "../api/supabase";
import { IonPage, IonContent, IonHeader, IonTitle, IonToolbar } from "@ionic/vue";

const { t } = useI18n();

const trendingMovies = ref<TrendingResponse["results"]>([]);
const trendingSeries = ref<SerieTrendingResponse["results"]>([]);
const recentVoiceActors = ref<Tables<'voice_actors'>[]>([]);
const topVoiceActors = ref<Tables<'voice_actors'>[]>([]);
const isLoadingMovies = ref(true);
const isLoadingSeries = ref(true);
const isLoadingVoiceActors = ref(true);
const isLoadingTopVoiceActors = ref(true);
const errorMovies = ref("");
const errorSeries = ref("");
const errorVoiceActors = ref("");
const errorTopVoiceActors = ref("");

onMounted(() => {
  isLoadingMovies.value = true;
  isLoadingSeries.value = true;
  isLoadingVoiceActors.value = true;
  isLoadingTopVoiceActors.value = true;
  errorMovies.value = "";
  errorSeries.value = "";
  errorVoiceActors.value = "";
  errorTopVoiceActors.value = "";

  // Fetch movies in parallel
  supabase.functions.invoke("trending-movies")
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
    });

  // Fetch series in parallel
  supabase.functions.invoke("trending-shows")
    .then((res) => {
      if (res.error) throw new Error(res.error.message || "Erreur inconnue");
      trendingSeries.value = res.data.results || [];
    })
    .catch((e) => {
      errorSeries.value = e.message || "Erreur lors du chargement des séries.";
      trendingSeries.value = [];
    })
    .finally(() => {
      isLoadingSeries.value = false;
    });

  // Fetch recent voice actors in parallel
  supabase.functions.invoke("recent-voice-actors", { body: { limit: 10 } })
    .then((res) => {
      if (res.error) throw new Error(res.error.message || "Erreur inconnue");
      recentVoiceActors.value = res.data || [];
    })
    .catch((e) => {
      errorVoiceActors.value = e.message || "Erreur lors du chargement des voix récentes.";
      recentVoiceActors.value = [];
    })
    .finally(() => {
      isLoadingVoiceActors.value = false;
    });

  // Fetch top voice actors in parallel
  supabase.functions.invoke("top-voice-actors", { body: { limit: 10 } })
    .then((res) => {
      if (res.error) throw new Error(res.error.message || "Erreur inconnue");
      topVoiceActors.value = res.data || [];
    })
    .catch((e) => {
      errorTopVoiceActors.value = e.message || "Erreur lors du chargement des top doubleurs.";
      topVoiceActors.value = [];
    })
    .finally(() => {
      isLoadingTopVoiceActors.value = false;
    });
});
</script>

<style scoped lang="scss">
.movies,
.series,
.voice-actors {
  display: flex;
  flex-direction: row;
  gap: 20px;
  padding: 8px 0 16px 0;
  overflow-x: auto;
  scroll-padding: 16px;
  // height: 263px;
}


.trending-movies, .trending-series, .recent-voice-actors, .top-voice-actors {
  margin-bottom: 32px;
  padding-left: 12px;
  margin-top: 32px;
}

.list-header {
  margin-bottom: 10px;
  font-weight: bold;
  font-size: 1.15em;
  letter-spacing: 0.02em;
}

.error-message {
  color: #d32f2f;
  background: #fff0f0;
  padding: 8px 12px;
  border-radius: 6px;
  margin: 8px 0;
}

.empty-message {
  color: #777;
  font-style: italic;
  margin: 8px 0;
}

</style>
