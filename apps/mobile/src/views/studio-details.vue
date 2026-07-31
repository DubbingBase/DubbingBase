<template>
  <ion-page>
    <AppPage>
      <AppHeader>
        <AppToolbar>
          <template #start>
            <AppBackButton />
          </template>
          <AppTitle>{{ studio?.name || 'Studio Details' }}</AppTitle>
          <template #end>
            <router-link
              v-if="studio?.id"
              :to="`/studio-edit/${studio.id}`"
              class="p-2 text-[var(--app-color-text-secondary)] hover:text-[color:var(--app-color-text-primary)] transition-colors"
              aria-label="Edit Studio"
            >
              <Pencil class="h-5 w-5" />
            </router-link>
          </template>
        </AppToolbar>
      </AppHeader>

      <AppContent class="p-4 space-y-6">
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
          <LoadingSpinner name="crescent" />
          <p class="text-xs text-slate-400 mt-2">Loading studio details...</p>
        </div>

        <div v-else-if="error" class="text-center py-12 text-red-400">
          <p>{{ error }}</p>
        </div>

        <div v-else-if="studio" class="space-y-6">
          <!-- Studio Profile Card -->
          <div class="bg-[var(--app-color-step-100)] border border-[var(--app-color-border)] rounded-2xl p-5 space-y-4">
            <div class="flex items-center space-x-4">
              <div class="h-16 w-16 rounded-2xl bg-[var(--app-color-step-50)] border border-[var(--app-color-border)] flex items-center justify-center overflow-hidden shrink-0">
                <img v-if="studio.logo_url" :src="studio.logo_url" class="h-full w-full object-cover" :alt="studio.name" />
                <span v-else class="text-2xl font-bold text-[var(--app-color-primary)]">{{ studio.name.charAt(0) }}</span>
              </div>
              <div>
                <h2 class="text-lg font-bold text-[color:var(--app-color-text-primary)]">{{ studio.name }}</h2>
                <p v-if="studio.city || studio.country" class="text-xs text-[var(--app-color-text-secondary)] flex items-center gap-1 mt-0.5">
                  <span>📍 {{ [studio.city, studio.country].filter(Boolean).join(', ') }}</span>
                </p>
                <a
                  v-if="studio.website_url"
                  :href="studio.website_url"
                  target="_blank"
                  class="text-xs text-[var(--app-color-primary)] hover:underline mt-1 block"
                >
                  🌐 Visit Official Website
                </a>
              </div>
            </div>

            <p v-if="studio.description" class="text-xs text-[color:var(--app-color-text-primary)] leading-relaxed border-t border-[var(--app-color-border)] pt-3">
              {{ studio.description }}
            </p>
          </div>

          <!-- Dubbed Media Catalog -->
          <div class="space-y-3">
            <h3 class="text-sm font-bold text-[color:var(--app-color-text-primary)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--app-color-border)] pb-2">
              <span>Dubbed Media Catalog</span>
              <span class="text-xs text-[var(--app-color-primary)] font-normal">({{ dubbedProjects.length }})</span>
            </h3>

            <div v-if="dubbedProjects.length === 0" class="text-center py-6 text-xs text-[var(--app-color-text-secondary)]">
              No dubbed media recorded for this studio yet.
            </div>

            <div v-else class="grid grid-cols-1 gap-2.5">
              <router-link
                v-for="project in dubbedProjects"
                :key="project.id"
                :to="project.content_type === 'movie' ? `/movie/${project.content_id}` : `/serie/${project.content_id}`"
                class="bg-[var(--app-color-step-100)] hover:bg-[var(--app-color-step-200)] border border-[var(--app-color-border)] rounded-xl p-3 flex items-center justify-between transition-colors"
              >
                <div>
                  <div class="text-xs font-semibold text-[color:var(--app-color-text-primary)]">Media ID #{{ project.content_id }}</div>
                  <div class="text-[10px] text-[var(--app-color-text-secondary)] uppercase flex items-center gap-2 mt-0.5">
                    <span class="px-1.5 py-0.5 bg-[var(--app-color-step-200)] rounded font-bold">{{ project.content_type }}</span>
                    <span>Lang: {{ project.language || 'fr-FR' }}</span>
                  </div>
                </div>
                <span class="text-xs text-[var(--app-color-primary)] font-semibold">View Details ↗</span>
              </router-link>
            </div>
          </div>

          <!-- Voice Actors Roster -->
          <div class="space-y-3">
            <h3 class="text-sm font-bold text-[color:var(--app-color-text-primary)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--app-color-border)] pb-2">
              <span>Voice Actor Roster</span>
              <span class="text-xs text-[var(--app-color-primary)] font-normal">({{ voiceActorsRoster.length }})</span>
            </h3>

            <div v-if="voiceActorsRoster.length === 0" class="text-center py-6 text-xs text-[var(--app-color-text-secondary)]">
              No voice actors linked to this studio yet.
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <router-link
                v-for="va in voiceActorsRoster"
                :key="va.id"
                :to="`/voice-actor-profile/${va.id}`"
                class="bg-[var(--app-color-step-100)] hover:bg-[var(--app-color-step-200)] border border-[var(--app-color-border)] rounded-xl p-3 flex items-center space-x-3 transition-colors"
              >
                <div class="h-10 w-10 rounded-full bg-[var(--app-color-step-50)] border border-[var(--app-color-border)] flex items-center justify-center font-bold text-xs text-[var(--app-color-primary)] overflow-hidden shrink-0">
                  <img v-if="va.profile_picture" :src="getProfileUrl(va.profile_picture)" class="h-full w-full object-cover" />
                  <span v-else>{{ va.firstname.charAt(0) }}{{ va.lastname.charAt(0) }}</span>
                </div>
                <div>
                  <div class="text-xs font-semibold text-[color:var(--app-color-text-primary)]">{{ va.firstname }} {{ va.lastname }}</div>
                  <div class="text-[10px] text-[var(--app-color-text-secondary)]">Voice Actor</div>
                </div>
              </router-link>
            </div>
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
import AppBackButton from "@/components/common/AppBackButton.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import Pencil from '~icons/lucide/pencil';

import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { supabase } from "@/api/supabase";

const route = useRoute();
const studioId = route.params.id as string;

const studio = ref<{ id: number; name: string; logo_path?: string } | null>(null);
const dubbedProjects = ref<Array<{ id: number }>>([]);
const voiceActorsRoster = ref<Array<{ id: number }>>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);

const getProfileUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("voice_actor_profile_pictures").getPublicUrl(path);
  return data.publicUrl;
};

const fetchStudioDetails = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const { data, error: funcError } = await supabase.functions.invoke(
      "get-studio-details",
      {
        body: { studioId },
      }
    );

    if (funcError) throw funcError;

    if (data) {
      studio.value = data.studio;
      dubbedProjects.value = data.dubbedProjects;
      voiceActorsRoster.value = data.voiceActorsRoster;
    }
  } catch (err: unknown) {
    console.error("Error fetching studio details:", err);
    error.value = (err as { message?: string })?.message || "Failed to load studio details";
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchStudioDetails);
</script>
