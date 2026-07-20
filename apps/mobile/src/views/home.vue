<template>
  <ion-page>
    <AppPage>
      <AppHeader>
        <AppToolbar>
          <div class="home-header">
            <div class="fake-searchbar" @click="router.push('/tabs/search')">
              <SearchIcon class="search-icon" />
              <span class="search-placeholder">Search...</span>
            </div>
            <div class="header-actions">
              <router-link
                v-if="authStore.isAuthenticated && !authStore.isAnonymous"
                to="/tabs/profile"
                class="header-icon-btn"
              >
                <UserIcon />
              </router-link>
              <router-link to="/tabs/settings" class="header-icon-btn">
                <SettingsIcon />
              </router-link>
            </div>
          </div>
        </AppToolbar>
      </AppHeader>
      <AppContent :fullscreen="true">
        <div class="trending-movies">
          <div class="list-header">{{ t("home.trendingMovies") }}</div>
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
              <div class="error-message">{{ t("home.moviesError") }}</div>
            </template>
            <template v-else-if="trendingMovies.length === 0">
              <div class="empty-message">{{ t("home.moviesEmpty") }}</div>
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
          <div class="list-header">{{ t("home.trendingSeries") }}</div>
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
              <div class="error-message">{{ t("home.seriesError") }}</div>
            </template>
            <template v-else-if="trendingSeries.length === 0">
              <div class="empty-message">{{ t("home.seriesEmpty") }}</div>
            </template>
            <template v-else>
              <MediaItem
                :key="show.id"
                v-for="show in trendingSeries"
                :imagePath="show.poster_path"
                :title="show.title || (show as any).name"
                routeName="SerieDetails"
                :routeParams="{ id: show.id }"
              ></MediaItem>
            </template>
          </div>
        </div>
        <div class="recent-voice-actors">
          <div class="list-header">{{ t("home.recentVoiceActors") }}</div>
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
              <div class="error-message">{{ t("home.voiceActorsError") }}</div>
            </template>
            <template v-else-if="recentVoiceActors.length === 0">
              <div class="empty-message">{{ t("home.voiceActorsEmpty") }}</div>
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
          <div class="list-header">{{ t("home.topVoiceActors") }}</div>
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
              <div class="error-message">
                {{ t("home.topVoiceActorsError") }}
              </div>
            </template>
            <template v-else-if="topVoiceActors.length === 0">
              <div class="empty-message">
                {{ t("home.topVoiceActorsEmpty") }}
              </div>
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
      </AppContent>
    </AppPage>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage } from "@ionic/vue";
import AppPage from "@/components/common/layout/AppPage.vue";
import AppHeader from "@/components/common/layout/AppHeader.vue";
import AppToolbar from "@/components/common/layout/AppToolbar.vue";
import AppTitle from "@/components/common/layout/AppTitle.vue";
import AppContent from "@/components/common/layout/AppContent.vue";
import { onMounted, ref } from "vue";
defineOptions({ name: "Home" });
import { useI18n } from "vue-i18n";
import type { TrendingResponse } from "@supabase/functions/_shared/movie";
import type { TrendingResponse as SerieTrendingResponse } from "@supabase/functions/_shared/serie";
import type { Tables } from "@/utils/database";
import MediaItem from "../components/MediaItem.vue";
import { supabase } from "../api/supabase";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import SearchIcon from "~icons/lucide/search";
import SettingsIcon from "~icons/lucide/settings";
import UserIcon from "~icons/lucide/user";

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const trendingMovies = ref<TrendingResponse["results"]>([]);
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

onMounted(() => {
  loadHomeData();
});

const handleRefresh = async (event: any) => {
  await loadHomeData();
  event.target.complete();
};
</script>

<style scoped lang="scss">
.home-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 4px 0;
}

.fake-searchbar {
  flex: 1;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 0 16px;
  height: 44px;
  cursor: pointer;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.search-icon {
  width: 18px;
  height: 18px;
  color: var(--app-color-text-muted, #8e8e8e);
  margin-right: 12px;
}

.search-placeholder {
  color: var(--app-color-text-muted, #8e8e8e);
  font-size: 15px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--app-color-text-primary, #ffffff);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-decoration: none;
}

.header-icon-btn svg {
  width: 20px;
  height: 20px;
}

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

.trending-movies,
.trending-series,
.recent-voice-actors,
.top-voice-actors {
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
