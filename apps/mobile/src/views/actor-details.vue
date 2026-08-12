<template>
  <ion-page>
  <AppPage>
    <AppHeader>
      <AppToolbar>
        <template #start >
          <AppBackButton />
        </template>
        <AppTitle>{{ t("actor.title") }}</AppTitle>
      </AppToolbar>
    </AppHeader>
    <AppContent>
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>
      
      <div class="actor">
        <div class="header-immersive" v-if="actor">
          <div
            class="header-backdrop"
            :style="{ backgroundImage: `url(${actor.profile_picture})` }"
          ></div>
          <div class="header-overlay"></div>
          <div class="header-content">
            <img :src="actor.profile_picture" class="main-avatar" alt="" />
            <div class="actor-name">{{ actor.name }}</div>
          </div>
        </div>

        <div class="body" v-if="actor && !loading">
          <AppSegment scrollable v-model="selectedSegment">
            <AppSegmentButton value="about" content-id="about">
              <AppText>{{ t("actor.about") }}</AppText>
            </AppSegmentButton>
            <AppSegmentButton value="roles" content-id="roles">
              <AppText>{{ t("actor.roles") }}</AppText>
            </AppSegmentButton>
          </AppSegment>
          <AppSegmentView v-model:active-segment="selectedSegment">
            <AppSegmentContent id="about">
              <div class="about-section" ref="aboutSectionRef">
                <div class="info-card" v-if="actor.data.birthday">
                  <div class="info-label">{{ t("actor.birthdate") }}</div>
                  <div class="info-value">
                    {{ formatDate(actor.data.birthday) }}
                  </div>
                </div>

                <div
                  class="info-card biography-card"
                  v-if="actor.data.biography"
                  @click="isBiographyExpanded = !isBiographyExpanded"
                >
                  <div class="info-label">{{ t("actor.biography") }}</div>
                  <div
                    class="info-value biography-text"
                    :class="{ clamped: !isBiographyExpanded }"
                  >
                    {{ actor.data.biography }}
                  </div>
                  <div
                    class="read-more-hint"
                    v-if="actor.data.biography.length > 150"
                  >
                    {{
                      isBiographyExpanded
                        ? t("common.showLess", "Show less")
                        : t("common.readMore", "Read more")
                    }}
                  </div>
                </div>

                <div
                  class="voice-actors-section"
                  v-if="filteredVoiceActors.length > 0"
                >
                  <div class="flex flex-col gap-2 mb-4">
                    <h3 class="section-title m-0">{{ t("actor.voiceActors") }}</h3>
                    <div class="flex flex-wrap gap-2" v-if="availableLanguages.length > 1">
                      <AppChip
                        v-for="lang in availableLanguages"
                        :key="lang"
                        :outline="selectedLanguage !== lang"
                        :color="selectedLanguage === lang ? 'primary' : 'medium'"
                        @click="selectedLanguage = lang"
                        class="cursor-pointer m-0"
                      >
                        {{ getDisplayLanguage(lang) }}
                      </AppChip>
                    </div>
                  </div>
                  <div class="voice-actors-scroller">
                    <div
                      class="voice-actor-card"
                      v-for="voiceActor in filteredVoiceActors"
                      :key="voiceActor.id"
                    >
                      <PersonItem :person="voiceActor" type="voice-actor" />
                    </div>
                  </div>
                </div>
              </div>
            </AppSegmentContent>
            <AppSegmentContent id="roles">
              <div class="roles-section" ref="rolesSectionRef">
                <div class="roles-list" v-if="tmdbRoles.length > 0">
                  <div
                    v-for="role in groupedTmdbRoles"
                    :key="role.mediaId"
                    class="role-group"
                  >
                    <div class="role-group-header">
                      <div class="role-media-info">
                        <img
                          v-if="role.poster_path"
                          :src="role.poster_path"
                          :alt="role.title"
                          class="role-poster"
                        />
                        <div class="role-details">
                          <h4>{{ role.title }}</h4>
                          <span class="role-year">{{ role.releaseYear }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="role-characters">
                      <div
                        v-for="character in role.roles"
                        :key="character.id"
                        class="character-item"
                      >
                        <span class="character-name">{{ character.character }}</span>
                        <div v-if="voiceActorsByMediaId.value.get(role.mediaId)?.length" class="voice-actors-inline">
                          <PersonItem
                            v-for="va in voiceActorsByMediaId.value.get(role.mediaId)"
                            :key="va.id"
                            :person="va"
                            type="voice-actor"
                            size="small"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="no-roles">
                  <p>{{ t("actor.noRoles") }}</p>
                </div>
              </div>
            </AppSegmentContent>
          </AppSegmentView>
        </div>

        <div v-if="error" class="text-center text-red-500 mt-4">
          {{ error }}
        </div>
      </div>
    </AppContent>
  </AppPage>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonRefresher,
  IonRefresherContent,
  IonPage,
  AppSegment,
  AppSegmentButton,
  AppSegmentView,
  AppSegmentContent,
} from "@ionic/vue";
import AppPage from '@/components/common/layout/AppPage.vue';
import AppHeader from '@/components/common/layout/AppHeader.vue';
import AppToolbar from '@/components/common/layout/AppToolbar.vue';
import AppTitle from '@/components/common/layout/AppTitle.vue';
import AppContent from '@/components/common/layout/AppContent.vue';
import { computed, onMounted, ref, watch, nextTick } from "vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from "vue-i18n";
import AppChip from '@/components/common/AppChip.vue';

import type {
  Actor,
  VoiceActorSummary,
  WorkPerformance,
  PersonData,
  MovieMedia,
  TVMedia,
} from "@supabase/functions/_shared/types";
import { supabase } from "../api/supabase";
import { actorToPersonData, voiceActorToPersonData } from "@/utils/convert";
import { PersonData as PersonDataType } from "@/components/PersonItem.vue";
import PersonItem from "@/components/PersonItem.vue";
import MovieCard from "@/components/MovieCard.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";

const { t } = useI18n();

const route = useRoute();
const router = useRouter();

// Type for TMDB Actor with credits
interface TMDB_Actor {
  id: number;
  name: string;
  profile_path: string | null;
  birthday: string | null;
  biography: string | null;
  credits: {
    cast: Array<{
      id: number;
      character: string;
      title?: string;
      name?: string;
      release_date?: string;
      first_air_date?: string;
      media_type?: string;
      poster_path?: string;
      roles?: Array<{ character?: string }>;
    }>;
  };
}

// Response from actor edge function
interface ActorResponse {
  actor: TMDB_Actor;
  voiceActors: WorkPerformance[];
}

const actor = ref<PersonDataType<Actor> | undefined>();
type VoiceActorData = PersonDataType<VoiceActorSummary>;
const voiceActors = ref<VoiceActorData[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const showDubbedOnly = ref<"true" | "false">("true");
const searchQuery = ref("");
const selectedSegment = ref("about");
const isBiographyExpanded = ref(false);

const availableLanguages = computed(() => {
  const langs = new Set<string>();
  voiceActors.value.forEach((role: any) => {
    if (role.data?.dubbing_projects?.language) {
      langs.add(role.data.dubbing_projects.language);
    }
  });
  return Array.from(langs).sort();
});

const selectedLanguage = ref<string>("");

watch(availableLanguages, (langs) => {
  if (langs.length > 0 && !selectedLanguage.value) {
    selectedLanguage.value = langs.includes("fr-FR") ? "fr-FR" : langs[0];
  }
}, { immediate: true });

const aboutSectionRef = ref<HTMLElement | null>(null);
const rolesSectionRef = ref<HTMLElement | null>(null);

const tmdbRoles = computed(() => {
  if (!actor.value?.data?.credits?.cast) return [];

  return actor.value.data.credits.cast.map((credit: { id: number; character: string; title?: string; name?: string; release_date?: string; first_air_date?: string; media_type?: string; poster_path?: string; roles?: Array<{ character?: string }> }) => {
    const title = credit.title || credit.name;
    const releaseDate = credit.release_date || credit.first_air_date;
    const releaseYear = releaseDate
      ? new Date(releaseDate).getFullYear().toString()
      : "";

    return {
      id: `${credit.id}-${credit.character}`,
      mediaId: credit.id,
      title,
      character: credit.character,
      releaseYear,
      mediaType: credit.media_type,
      poster_path: credit.poster_path,
      release_date: credit.release_date,
      first_air_date: credit.first_air_date};
  });
});

const groupedTmdbRoles = computed(() => {
  const groups = new Map();

  tmdbRoles.value.forEach((role) => {
    const key = `${role.mediaId}-${role.mediaType}`;
    if (!groups.has(key)) {
      groups.set(key, {
        mediaId: role.mediaId,
        mediaType: role.mediaType,
        title: role.title,
        releaseYear: role.releaseYear,
        poster_path: role.poster_path,
        release_date: role.release_date,
        first_air_date: role.first_air_date,
        roles: [],
        voice_actors: voiceActorsByMediaId.value.get(role.mediaId) || []});
    }
    groups.get(key).roles.push({
      character: role.character,
      id: role.id});
  });

  return Array.from(groups.values()).sort((a, b) => {
    const dateA = a.release_date || a.first_air_date || "";
    const dateB = b.release_date || b.first_air_date || "";
    return dateB.localeCompare(dateA);
  });
});

const voiceActorsByMediaId = computed(() => {
  const map = new Map<number, VoiceActorData[]>();
  
  voiceActors.value.forEach(va => {
    const mediaId = va.data?.dubbing_projects?.content_id;
    if (!mediaId) return;
    
    if (!map.has(mediaId)) {
      map.set(mediaId, []);
    }
    map.get(mediaId)!.push(va);
  });
  
  return map;
});

const filteredVoiceActors = computed(() => {
  if (!selectedLanguage.value) return voiceActors.value;
  return voiceActors.value.filter((va: VoiceActorData) => 
    va.data?.dubbing_projects?.language === selectedLanguage.value
  );
});

const loadActorData = async () => {
  const id = route.params.id;
  if (!id) return;
  
  loading.value = true;
  error.value = null;

  try {
    console.log('Invoking Supabase function "actor" with id:', id);
    const actorResponseRaw = await supabase.functions.invoke<ActorResponse>("actor", {
      body: { id }});
    console.log("Raw Supabase response:", actorResponseRaw);
    const actorResponse = actorResponseRaw.data;
    console.log("Parsed actor response:", actorResponse);

    if (!actorResponse || !actorResponse.actor) {
      throw new Error("Actor not found");
    }

    // Fix: Properly assign actor data including all required fields
    const convertedActor = actorToPersonData(actorResponse.actor);
    actor.value = convertedActor;

    console.log("Converted actor data:", actor.value);
    
    // Convert voice actors with media details
    voiceActors.value = (actorResponse.voiceActors || []).map((work: WorkPerformance) => {
      // Find character name from mediaDetails
      let character = work.suggestions || work.performance || "";
      if (work.mediaDetails && work.mediaDetails.credits?.cast) {
        const castMember = work.mediaDetails.credits.cast.find((c: any) => c.id === work.actor_id);
        if (castMember) character = castMember.character;
      }
      
      return voiceActorToPersonData(
        {
          id: work.voice_actor?.id || 0,
          firstname: work.voice_actor?.firstname || "",
          lastname: work.voice_actor?.lastname || "",
          profile_picture: work.voice_actor?.profile_picture || "",
        },
        work.performance || "",
        work.actor_id,
        work.status,
        work.id,
      ) as VoiceActorData & { 
        data: { 
          dubbing_projects?: { content_id: number; language: string; content_type: string } 
        }
      };
    });
    
    console.log("Voice actors:", voiceActors.value);
  } catch (err) {
    console.error("Error fetching actor data:", err);
    error.value =
      err instanceof Error ? err.message : "Failed to load actor data";
  } finally {
    loading.value = false;
  }
};

const handleRefresh = async (event: CustomEvent) => {
  try {
    await loadActorData();
  } catch (err) {
    console.error("Error refreshing data:", err);
  } finally {
    (event.target)?.complete();
  }
};

function retryLoad() {
  loadActorData();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString(navigator.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDisplayLanguage(lang: string): string {
  const langMap: Record<string, string> = {
    "fr-FR": "Français",
    "en-US": "English",
    "es-ES": "Español",
    "de-DE": "Deutsch",
    "it-IT": "Italiano",
    "pt-BR": "Português",
    "ja-JP": "日本語",
    "zh-CN": "中文",
    "ko-KR": "한국어",
  };
  return langMap[lang] || lang;
}

onMounted(() => {
  loadActorData();
});
</script>

<style scoped lang="scss">
.actor {
  padding: 0;
  margin: 0 auto;
}

.about-section {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .info-card {
    background: rgba(20, 20, 20, 0.95);
    border-radius: 12px;
    padding: 1.25rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    border: 1px solid var(--app-overlay-5);

    .info-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--app-color-text-secondary);
      margin-bottom: 0.5rem;
      font-weight: 600;
    }

    .info-value {
      font-size: 1.1rem;
      color: var(--app-color-text-primary);
    }

    &.biography-card {
      cursor: pointer;

      .biography-text {
        font-size: 0.95rem;
        line-height: 1.6;
        color: var(--app-color-step-800, #ddd);
        transition: max-height 0.3s ease;

        &.clamped {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      }

      .read-more-hint {
        margin-top: 8px;
        font-size: 0.85rem;
        color: var(--app-color-text-secondary);
      }
    }
  }
}

.voice-actors-section {
  padding: 0 1rem;

  .section-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--app-color-text-primary);
  }
}

.voice-actors-scroller {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice-actor-card {
  background: rgba(20, 20, 20, 0.95);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--app-overlay-5);
}

.roles-section {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.roles-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.role-group {
  background: rgba(20, 20, 20, 0.95);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--app-overlay-5);
}

.role-group-header {
  display: flex;
  align-items: center;
  padding: 1rem;
  gap: 1rem;
  background: var(--app-overlay-2);
  border-bottom: 1px solid var(--app-overlay-5);
}

.role-poster {
  width: 60px;
  height: 90px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
}

.role-details {
  flex: 1;
  min-width: 0;

  h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--app-color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .role-year {
    font-size: 0.85rem;
    color: var(--app-color-text-secondary);
  }
}

.role-characters {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.character-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: var(--app-overlay-2);
  border-radius: 8px;
  border: 1px solid var(--app-overlay-5);

  .character-name {
    flex: 1;
    font-weight: 500;
    color: var(--app-color-text-primary);
  }

  .voice-actors-inline {
    display: flex;
    gap: 0.5rem;
  }
}

.no-roles {
  text-align: center;
  padding: 2rem;
  color: var(--app-color-text-secondary);
}
</style>
