<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="{ name: 'Home' }" />
        </ion-buttons>
        <ion-title>{{ t("actor.title") }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="actor">
        <div class="header" v-if="actor">
          <img :src="actor.profile_picture" alt="" />
          <div class="actor-name">{{ actor.name }}</div>
        </div>

        <div class="body" v-if="actor && !loading">
          <ion-segment scrollable>
            <ion-segment-button value="about" content-id="about">
              <ion-label>{{ t("actor.about") }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="roles" content-id="roles">
              <ion-label>{{ t("actor.roles") }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="voiceActors" content-id="voiceActors">
              <ion-label>{{ t("actor.voiceActors") }}</ion-label>
            </ion-segment-button>
          </ion-segment>

          <ion-segment-view>
            <ion-segment-content id="about">
              <div class="about-section">
                <div class="info-item" v-if="actor.data.birthday">
                  <strong>{{ t("actor.birthdate") }}:</strong>
                  {{ formatDate(actor.data.birthday) }}
                </div>
                <div class="biography" v-if="actor.data.biography">
                  <strong>{{ t("actor.biography") }}:</strong>
                  <p>{{ actor.data.biography }}</p>
                </div>
              </div>
            </ion-segment-content>
            <ion-segment-content id="roles">
              <div class="voice-roles-section">
                <ion-segment
                  scrollable
                  class="role-toggle"
                  v-model="showDubbedOnly"
                >
                  <ion-segment-button value="true">
                    <ion-label>{{ t("actor.dubbedOnly") }}</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="false">
                    <ion-label>{{ t("actor.allRoles") }}</ion-label>
                  </ion-segment-button>
                </ion-segment>

                <div class="section-header">
                  <h2>{{ t("actor.roles") }}</h2>
                  <ion-chip outline color="primary" class="role-count">
                    {{ roleCount }}
                    {{ roleCount > 1 ? t("actor.roles") : t("actor.role") }}
                  </ion-chip>
                </div>

                <div class="grouped-roles-list">
                  <div
                    v-for="group in groupedRolesToShow"
                    :key="`${group.mediaId}-${group.mediaType}`"
                    class="media-group"
                  >
                    <router-link
                      :to="{
                        name:
                          group.mediaType === 'movie'
                            ? `MovieDetails`
                            : `SerieDetails`,
                        params: { id: group.mediaId },
                      }"
                      class="no-link"
                    >
                      <MovieCard
                        :media="group"
                        :character="group.roles.map((r: any) => r.character).filter(Boolean).join(', ')"
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
                              va.actor_id
                            )
                          "
                          type="voice-actor"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ion-segment-content>
            <ion-segment-content id="voiceActors">
              <div class="voice-actors-wrapper">
                <PersonItem
                  v-for="voiceActor in groupedVoiceActors"
                  :key="voiceActor.id"
                  :person="voiceActor"
                  type="voice-actor"
                />
              </div>
            </ion-segment-content>
          </ion-segment-view>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-container">
        <ion-spinner name="crescent"></ion-spinner>
        <p>{{ t("common.loading") }}</p>
      </div>

      <!-- Error State -->
      <div v-if="error && !loading" class="error-container">
        <ion-icon :icon="alertCircle" size="large" color="danger"></ion-icon>
        <h3>{{ t("common.error") }}</h3>
        <p>{{ error }}</p>
        <ion-button @click="retryLoad">{{ t("common.retry") }}</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  IonPage,
  IonBackButton,
  IonButtons,
  IonTitle,
  IonToolbar,
  IonHeader,
  IonChip,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonSegmentView,
  IonSegmentContent,
  IonContent,
  IonSpinner,
  IonButton,
} from "@ionic/vue";
import { alertCircle } from "ionicons/icons";
import type { Actor } from "../../supabase/functions/_shared/types";
import { supabase } from "../api/supabase";
import { actorToPersonData, voiceActorToPersonData } from "@/utils/convert";
import { PersonData } from "@/components/PersonItem.vue";
import PersonItem from "@/components/PersonItem.vue";
import MovieCard from "@/components/MovieCard.vue";

const { t } = useI18n();

const route = useRoute();

const actor = ref<PersonData<Actor>>();
const voiceActors = ref<any[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const showDubbedOnly = ref<"true" | "false">("true");

const tmdbRoles = computed(() => {
  if (!actor.value?.data?.credits?.cast) return [];

  return actor.value.data.credits.cast.map((credit: any) => {
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
      first_air_date: credit.first_air_date,
    };
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
        voice_actors: voiceActorsByMediaId.value.get(role.mediaId) || [],
      });
    }
    groups.get(key).roles.push({
      character: role.character,
      id: role.id,
    });
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
      mediaIdsWithDubs.value.has(group.mediaId)
    );
  }
  return groupedTmdbRoles.value;
});

const mediaIdsWithDubs = computed(() => {
  return new Set(
    voiceActors.value.map((va: any) => va.mediaDetails?.id).filter(Boolean)
  );
});

const voiceActorsByMediaId = computed(() => {
  const map = new Map();
  voiceActors.value.forEach((va: any) => {
    map.set(va.mediaDetails.id, va.voice_actors);
  });
  return map;
});

const sortedVoiceActors = computed(() => {
  const voiceActorMap = new Map();

  // Aggregate voice actors and count their roles
  voiceActors.value.forEach((role: any) => {
    role.voice_actors.forEach((va: any) => {
      if (!voiceActorMap.has(va.id)) {
        voiceActorMap.set(va.id, {
          ...va,
          roleCount: 0,
        });
      }
      voiceActorMap.get(va.id).roleCount += 1;
    });
  });

  // Convert to array and sort by role count descending
  return Array.from(voiceActorMap.values()).sort(
    (a, b) => b.roleCount - a.roleCount
  );
});

const groupedVoiceActors = computed(() => {
  return sortedVoiceActors.value.map((voiceActor: any) => ({
    id: voiceActor.id,
    name: `${voiceActor.firstname} ${voiceActor.lastname}`,
    tmdb_id: voiceActor.id,
    profile_picture: voiceActor.profile_picture,
    performance: `${voiceActor.roleCount} ${
      voiceActor.roleCount > 1 ? t("actor.roles") : t("actor.role")
    }`,
    tags: voiceActor.is_official ? ["official"] : [],
    data: voiceActor,
  }));
});

const roleCount = computed(() => {
  return groupedRolesToShow.value.length;
});

function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString();
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
      body: { id },
    });
    console.log("Raw Supabase response:", actorResponseRaw);
    const actorResponse = (await actorResponseRaw.data) as {
      actor: Actor;
      voiceActors?: any[];
    };
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

  .info-item {
    margin-bottom: 1rem;
    font-size: 1rem;

    strong {
      color: var(--ion-color-primary);
    }
  }

  .biography {
    margin-top: 1.5rem;

    strong {
      color: var(--ion-color-primary);
      display: block;
      margin-bottom: 0.5rem;
    }

    p {
      margin: 0;
      line-height: 1.6;
      color: var(--ion-text-color);
    }
  }
}

.media-voice-roles {
  margin-bottom: 2rem;
  background: var(--ion-color-light);
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
  background: var(--ion-color-light-shade);
}

.voice-roles-list {
  padding: 0.5rem 0;
  background: var(--ion-color-light);

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
    background: var(--ion-color-light-shade);
    border-radius: 50%;
    color: var(--ion-color-medium);

    ion-icon {
      font-size: 1.5rem;
    }
  }
}

.voice-actor-details {
  h3 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 500;
    color: var(--ion-color-dark);
  }

  p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ion-color-medium);

    ion-icon {
      margin-right: 0.25rem;
      vertical-align: middle;
    }
  }

  .voice-role-performance {
    font-weight: 500;
    color: var(--ion-color-primary);
  }
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0;
  background: linear-gradient(
    to bottom,
    var(--ion-color-light) 0%,
    transparent 100%
  );
  margin-bottom: 1rem;

  img {
    height: 200px;
    width: 160px;
    object-fit: cover;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    margin-bottom: 1rem;
  }

  .actor-name {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--ion-text-color);
    text-align: center;
  }
}

.voice-roles-section {
  margin: 1.5rem 0;
  padding: 0 1rem;

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
      color: var(--ion-text-color);
    }

    .role-count {
      margin-left: 0.75rem;
      font-size: 0.8rem;
      height: 1.75rem;
    }
  }
}

.voice-actors-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
}

.grouped-roles-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .media-group {
    background: var(--ion-item-background);
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    &:active {
      transform: translateY(1px);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .roles-list {
      padding: 0.5rem 1rem;
      border-top: 1px solid var(--ion-color-light-shade);
      background: var(--ion-color-light);

      .role-detail {
        padding: 0.25rem 0;

        &:not(:last-child) {
          border-bottom: 1px solid var(--ion-color-light-shade);
        }

        .character-name {
          font-size: 0.85rem;
          color: var(--ion-color-medium);
          font-style: italic;
        }
      }
    }

    .voice-actors-section {
      border-top: 1px solid var(--ion-color-light-shade);
      background: var(--ion-color-light);

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
