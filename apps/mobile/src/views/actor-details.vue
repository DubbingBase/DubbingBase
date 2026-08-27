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
              <div class="voice-roles-section" ref="rolesSectionRef">
                <AppSearchbar
                  v-model="searchQuery"
                  :placeholder="t('common.search', 'Search...')"
                  animated
                  class="custom-searchbar"
                  style="margin-bottom: 1rem;"
                ></AppSearchbar>
                
                <div class="filters-row">
                  <span class="filter-label">{{ showDubbedOnly === 'true' ? t("actor.dubbedOnly") : t("actor.allRoles") }}</span>
                  <AppToggle
                    :checked="showDubbedOnly === 'true'"
                    @ionChange="showDubbedOnly = $event.detail.checked ? 'true' : 'false'"
                    class="sleek-toggle"
                  />
                </div>

                <div class="section-header">
                  <h2>{{ t("actor.roles") }}</h2>
                  <AppChip outline color="primary" class="role-count">
                    {{ roleCount }}
                    {{ roleCount > 1 ? t("actor.roles") : t("actor.role") }}
                  </AppChip>
                </div>

                <div class="grouped-roles-list">
                  <div
                    v-for="group in filteredRolesToShow"
                    :key="`${group.mediaId}-${group.mediaType}`"
                    class="media-group"
                  >
                    <router-link
                      :to="{
                        name:
                          group.mediaType === 'movie'
                            ? `MovieDetails`
                            : `SerieDetails`,
                        params: { id: group.mediaId }}"
                      class="no-link"
                    >
                      <MovieCard
                        :media="group"
                        :character="
                          group.roles
                            .map(r => r.character)
                            .filter(Boolean)
                            .join(', ')
                        "
                        :media-type="group.mediaType"
                      />
                    </router-link>
                    <div class="roles-list" v-if="group.roles.length > 1">
                      <div
                        v-for="role in group.roles"
                        :key="role.id"
                        class="role-detail"
                      >
                        <span class="character-name">{{ role.character }}</span>
                      </div>
                    </div>
                    <div
                      class="voice-actors-section"
                      v-if="group.voice_actors.length > 0"
                    >
                      <div class="voice-actors-list">
                        <PersonItem
                          v-for="va in group.voice_actors"
                          :key="va.id"
                          :person="
                            voiceActorToPersonData(
                              va,
                              va.performance,
                              va.actor_id,
                            )
                          "
                          type="voice-actor"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AppSegmentContent>
          </AppSegmentView>
        </div>
      </div>

      <LoadingSpinner v-if="loading" />

      <!-- Error State -->
      <div v-if="error && !loading" class="error-container">
        <AlertCircle class="app-icon" />
        <h3>{{ t("common.error") }}</h3>
        <p>{{ error }}</p>
        <AppButton @click="retryLoad">{{ t("common.retry") }}</AppButton>
      </div>
    </AppContent>
  </AppPage>
  </ion-page>
</template>

<script setup lang="ts">
import { IonRefresher, IonRefresherContent } from "@ionic/vue";
import { IonPage } from "@ionic/vue";
import AppPage from '@/components/common/layout/AppPage.vue';
import AppHeader from '@/components/common/layout/AppHeader.vue';
import AppToolbar from '@/components/common/layout/AppToolbar.vue';
import AppTitle from '@/components/common/layout/AppTitle.vue';
import AppContent from '@/components/common/layout/AppContent.vue';
import AppSegment from '@/components/common/layout/AppSegment.vue';
import AppSegmentButton from '@/components/common/layout/AppSegmentButton.vue';
import AppSegmentView from '@/components/common/layout/AppSegmentView.vue';
import AppSegmentContent from '@/components/common/layout/AppSegmentContent.vue';
import AppButton from '@/components/common/AppButton.vue';
import AppSearchbar from '@/components/common/AppSearchbar.vue';
import AppToggle from '@/components/common/AppToggle.vue';
import AppText from '@/components/common/AppText.vue';
import AlertCircle from '~icons/lucide/alert-circle';
import AppSpinner from '@/components/common/AppSpinner.vue';
import AppSkeleton from '@/components/common/AppSkeleton.vue';
import { computed, onMounted, ref, watch, nextTick } from "vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from "vue-i18n";
import AppChip from '@/components/common/AppChip.vue';

import type { Actor } from "@supabase/functions/_shared/types";
import { supabase } from "../api/supabase";
import { actorToPersonData, voiceActorToPersonData } from "@/utils/convert";
import { PersonData } from "@/components/PersonItem.vue";
import PersonItem from "@/components/PersonItem.vue";
import MovieCard from "@/components/MovieCard.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";

const { t } = useI18n();

const route = useRoute();
const router = useRouter();

const actor = ref<PersonData<Actor>>();
type VoiceActorData = { id: number; firstname: string; lastname: string; profile_picture: string; is_official?: boolean; mediaDetails?: { id: number }; voice_actors?: VoiceActorData[] };
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
    if (role.dubbing_projects?.language) {
      langs.add(role.dubbing_projects.language);
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
    console.log("key", key);
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
    const dateA = new Date(a.release_date || a.first_air_date || "1900-01-01");
    const dateB = new Date(b.release_date || b.first_air_date || "1900-01-01");
    return dateB.getTime() - dateA.getTime();
  });
});

const groupedRolesToShow = computed(() => {
  if (showDubbedOnly.value === "true") {
    return groupedTmdbRoles.value.filter((group) =>
      mediaIdsWithDubs.value.has(group.mediaId),
    );
  }
  return groupedTmdbRoles.value;
});

const filteredRolesToShow = computed(() => {
  const query = searchQuery.value.toLowerCase();
  if (!query) return groupedRolesToShow.value;

  return groupedRolesToShow.value
    .map((group) => {
      const titleMatch = (group.title || "").toLowerCase().includes(query);
      const rolesMatch = group.roles.filter((r: { character?: string }) =>
        (r.character || "").toLowerCase().includes(query),
      );
      const vaMatch = group.voice_actors.filter((va: VoiceActorData) =>
        `${va.firstname} ${va.lastname}`.toLowerCase().includes(query),
      );

      if (titleMatch || rolesMatch.length > 0 || vaMatch.length > 0) {
        return {
          ...group,
          // If the title matches, show everything. Otherwise, only show matched roles/VA (or maybe keep all roles if matched? Let's just return the whole group if any matches)
        };
      }
      return null;
    })
    .filter(Boolean);
});

const mediaIdsWithDubs = computed(() => {
  return new Set(
    voiceActors.value.map((va: VoiceActorData) => va.mediaDetails?.id).filter(Boolean),
  );
});

const voiceActorsByMediaId = computed(() => {
  const map = new Map();
  voiceActors.value.forEach((va: VoiceActorData) => {
    map.set(va.mediaDetails?.id, va.voice_actors);
  });
  return map;
});

const sortedVoiceActors = computed(() => {
  const voiceActorMap = new Map();

  // Aggregate voice actors and count their roles
  voiceActors.value.forEach((role: VoiceActorData & { dubbing_projects?: { language: string } }) => {
    if (selectedLanguage.value && role.dubbing_projects?.language !== selectedLanguage.value) return;

    role.voice_actors?.forEach((va: VoiceActorData) => {
      if (!voiceActorMap.has(va.id)) {
        voiceActorMap.set(va.id, {
          ...va,
          roleCount: 0});
      }
      voiceActorMap.get(va.id).roleCount += 1;
    });
  });

  // Convert to array and sort by role count descending
  return Array.from(voiceActorMap.values()).sort(
    (a, b) => b.roleCount - a.roleCount,
  );
});

const groupedVoiceActors = computed(() => {
  return sortedVoiceActors.value.map((voiceActor: VoiceActorData & { roleCount: number }) => ({
    id: voiceActor.id,
    name: `${voiceActor.firstname} ${voiceActor.lastname}`,
    tmdb_id: voiceActor.id,
    profile_picture: voiceActor.profile_picture,
    performance: `${voiceActor.roleCount} ${
      voiceActor.roleCount > 1 ? t("actor.roles") : t("actor.role")
    }`,
    tags: voiceActor.is_official ? ["official"] : [],
    data: voiceActor}));
});

const filteredVoiceActors = computed(() => {
  const query = searchQuery.value.toLowerCase();
  if (!query) return groupedVoiceActors.value;

  return groupedVoiceActors.value.filter(
    (va) =>
      (va.name || "").toLowerCase().includes(query) ||
      (va.performance || "").toLowerCase().includes(query),
  );
});

const roleCount = computed(() => {
  return groupedRolesToShow.value.length;
});

function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function getDisplayLanguage(langCode: string | undefined | null) {
  if (!langCode) return 'Inconnu';
  try {
    const displayNames = new Intl.DisplayNames(['fr'], { type: 'language' });
    const name = displayNames.of(langCode);
    return (typeof name === 'string' && name.length > 0)
      ? name.charAt(0).toUpperCase() + name.slice(1)
      : langCode;
  } catch (e) {
    return langCode;
  }
}

async function loadActorData() {
  const id = route.params.id;
  console.log("Route params:", route.params);
  console.log("Actor ID from route:", id);

  loading.value = true;
  error.value = null;

  try {
    console.log('Invoking Supabase function "actor" with id:', id);
    const actorResponseRaw = await supabase.functions.invoke("actor", {
      body: { id }});
    console.log("Raw Supabase response:", actorResponseRaw);
    const actorResponse: { data?: { credits?: { cast?: Array<{ id: number; character: string; title?: string; name?: string; release_date?: string; first_air_date?: string; media_type?: string; poster_path?: string }> } } } = await actorResponseRaw.data;
    console.log("Parsed actor response:", actorResponse);

    // Fix: Properly assign actor data including all required fields
    const convertedActor = actorToPersonData(actorResponse.actor);
    actor.value = convertedActor;

    console.log("Converted actor data:", actor.value);
    voiceActors.value = actorResponse.voiceActors || [];
    console.log("Voice actors:", voiceActors.value);
  } catch (err) {
    console.error("Error fetching actor data:", err);
    error.value =
      err instanceof Error ? err.message : "Failed to load actor data";
  } finally {
    loading.value = false;
  }
}

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
        color: var(--app-color-primary);
        font-weight: 600;
        text-align: right;
      }
    }
  }

  .voice-actors-section {
    margin-top: 1rem;

    .section-title {
      font-size: 1.2rem;
      font-weight: 600;
      margin: 0 0 1rem 0;
      padding-left: 0.5rem;
      color: var(--app-color-text-primary);
    }

    .voice-actors-scroller {
      display: flex;
      overflow-x: auto;
      gap: 12px;
      padding-bottom: 1rem;
      scroll-snap-type: x mandatory;

      &::-webkit-scrollbar {
        display: none;
      }

      .voice-actor-card {
        scroll-snap-align: start;
        flex: 0 0 280px;
        background: rgba(20, 20, 20, 0.95);
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid var(--app-overlay-5);
      }
    }
  }
}

.media-voice-roles {
  margin-bottom: 2rem;
  background: var(--app-color-step-50);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  & + .media-voice-roles {
    margin-top: 1.5rem;
  }
}

.media-header {
  display: flex;
  padding: 1rem;
  width: 100%;
  background: var(--app-color-border-light);
}

.voice-roles-list {
  padding: 0.5rem 0;
  background: var(--app-color-step-50);

  .voice-role-item {
    --padding-start: 1rem;
    --padding-end: 1rem;
    --min-height: 72px;

    &::part(native) {
      padding-top: 0.75rem;
      padding-bottom: 0.75rem;
    }
  }
}

.voice-actor-avatar {
  width: 48px;
  height: 48px;
  margin-right: 1rem;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  .fallback-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: var(--app-color-border-light);
    border-radius: 50%;
    color: var(--app-color-text-secondary);

    .app-icon {
      font-size: 1.5rem;
    }
  }
}

.voice-actor-details {
  h3 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 500;
    color: var(--app-color-text-primary);
  }

  p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--app-color-text-secondary);

    .app-icon {
      margin-right: 0.25rem;
      vertical-align: middle;
    }
  }

  .voice-role-performance {
    font-weight: 500;
    color: var(--app-color-primary);
  }
}

.header-immersive {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 3rem 1rem 1.5rem;
  margin-bottom: 1.5rem;
  overflow: hidden;

  .header-backdrop {
    position: absolute;
    top: -10%;
    left: -10%;
    right: -10%;
    bottom: -10%;
    background-size: cover;
    background-position: center;
    filter: blur(20px);
    z-index: 0;
    opacity: 0.6;
  }

  .header-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.2) 0%,
      var(--app-background-color, #121212) 100%
    );
    z-index: 1;
  }

  .header-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;

    .main-avatar {
      height: 180px;
      width: 180px;
      object-fit: cover;
      border-radius: 50%;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      margin-bottom: 1rem;
      border: 3px solid var(--app-overlay-10);
    }

    .actor-name {
      font-size: 1.75rem;
      font-weight: 700;
      color: #fff;
      text-align: center;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }
  }
}

AppSegmentView, AppSegmentContent {
  overflow-y: hidden;
}

.voice-roles-section {
  padding: 1.5rem 1rem;

  .filters-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(20, 20, 20, 0.95);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    border: 1px solid var(--app-overlay-5);

    .filter-label {
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--app-color-text-primary);
    }

    .sleek-toggle {
      --background: var(--app-overlay-10);
      --handle-background: var(--app-color-text-secondary);
      --background-checked: var(--app-color-primary);
      --handle-background-checked: #fff;
      padding: 0;
    }
  }

  .role-toggle {
    margin-bottom: 1rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;

    h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--app-color-text-primary);
    }

    .role-count {
      margin-left: 0.75rem;
      font-size: 0.8rem;
      height: 1.75rem;
    }
  }
}

.grouped-roles-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .media-group {
    background: var(--app-color-card);
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    overflow: hidden;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;

    &:active {
      transform: translateY(1px);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .roles-list {
      padding: 0.5rem 1rem;
      border-top: 1px solid var(--app-color-border-light);
      background: var(--app-color-step-50);

      .role-detail {
        padding: 0.25rem 0;

        &:not(:last-child) {
          border-bottom: 1px solid var(--app-color-border-light);
        }

        .character-name {
          font-size: 0.85rem;
          color: var(--app-color-text-secondary);
          font-style: italic;
        }
      }
    }

    .voice-actors-section {
      border-top: 1px solid var(--app-color-border-light);
      background: var(--app-color-step-50);

      .voice-actors-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
    }
  }
}

// Mobile-only styles - no desktop hover states
@media (min-width: 768px) {
  .voice-roles-section {
    margin: 2rem auto;
    padding: 0 1.5rem;
  }

  .voice-roles-list {
    .voice-role-item {
      --padding-start: 1rem;
      --padding-end: 1rem;
      --inner-padding-end: 1rem;
    }
  }
}

</style>
