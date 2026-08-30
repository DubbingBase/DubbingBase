<template>
  <div class="min-h-screen">
    <!-- Skeleton loader during SSR/fetch -->
    <MediaSkeleton v-if="pending && !data" />

    <!-- Main Content -->
    <MediaDetailsLayout
      v-else-if="advertisement"
      :backdrop-src="null"
      :poster-src="posterUrl"
      :title="advertisement.title"
      :original-title="advertisement.brand"
      :media-type="'advertisement'"
      :release-year="advertisement.year ? String(advertisement.year) : undefined"
      :overview="advertisement.description"
      :dubbing-projects="dubbingProjects"
      :active-dub-id="activeDubId"
    >
      <template #header-actions>
        <div class="flex items-center gap-2">
          <NuxtLink
            v-if="isAdmin"
            :to="
              localePath(
                activeDubProject
                  ? `/advertisement/${advertisement.id}/edit/${activeDubProject.id}`
                  : `/advertisement/${advertisement.id}/edit/new`,
              )
            "
            class="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold rounded-xl border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
          >
            <span>{{
              activeDubProject ? "Modifier le projet" : "Ajouter un projet"
            }}</span>
          </NuxtLink>

          <ForceEnqueueButton
            v-if="advertisement?.id"
            media-type="advertisement"
            :media-id="advertisement.id"
          />
        </div>
      </template>

      <template #details-extra>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-800/60">
          <div v-if="advertisement.brand">
            <span class="text-xs text-gray-400 block mb-0.5">Marque / Annonceur</span>
            <span class="text-sm font-semibold text-gray-200">{{ advertisement.brand }}</span>
          </div>

          <div v-if="advertisement.agency">
            <span class="text-xs text-gray-400 block mb-0.5">Agence de publicité</span>
            <span class="text-sm font-semibold text-gray-200">{{ advertisement.agency }}</span>
          </div>

          <div v-if="advertisement.country">
            <span class="text-xs text-gray-400 block mb-0.5">Pays / Diffusion</span>
            <span class="text-sm font-semibold text-gray-200">{{ advertisement.country }}</span>
          </div>
        </div>
      </template>

      <!-- Video Player Embed if YouTube/video ID present -->
      <template #media-extra>
        <div
          v-if="advertisement.video_id"
          class="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4 mb-8 shadow-xl"
        >
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Spot Vidéo
          </h3>
          <div class="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg">
            <iframe
              :src="`https://www.youtube.com/embed/${advertisement.video_id}`"
              class="w-full h-full"
              allowfullscreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>
          </div>
        </div>
      </template>

      <!-- Technical Crew / Studio Section -->
      <template #crew-section>
        <div
          v-if="activeDubProject?.studios || activeDubProject?.dubbing_project_crew?.length"
          class="bg-gray-900/60 backdrop-blur border border-gray-800 rounded-2xl p-6 space-y-4 mb-8 shadow-xl"
        >
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Studio & Production Sonore
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div v-if="activeDubProject?.studios" class="space-y-1">
              <span class="text-xs text-gray-400">Studio d'enregistrement</span>
              <NuxtLink
                :to="localePath(`/studio/${activeDubProject.studios.id}`)"
                class="text-sm font-semibold text-emerald-400 hover:underline block"
              >
                {{ activeDubProject.studios.name }}
              </NuxtLink>
            </div>

            <div
              v-for="member in activeDubProject?.dubbing_project_crew || []"
              :key="member.id"
              class="space-y-1"
            >
              <span class="text-xs text-gray-400">{{ member.jobs?.name || "Équipe" }}</span>
              <NuxtLink
                v-if="member.voice_actors"
                :to="localePath(`/voice-actor/${member.voice_actors.id}`)"
                class="text-sm font-semibold text-white hover:underline block"
              >
                {{ member.voice_actors.firstname }} {{ member.voice_actors.lastname }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </template>

      <!-- Voice Cast Section -->
      <template #cast-section>
        <section class="space-y-6">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 class="text-xl font-bold text-white flex items-center gap-2">
                <span>Voix Off & Comédiens</span>
                <span
                  v-if="formattedCast.length > 0"
                  class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20"
                >
                  {{ formattedCast.length }}
                </span>
              </h2>
              <p class="text-xs text-gray-400 mt-1">
                Comédiens ayant prêté leur voix pour ce spot publicitaire.
              </p>
            </div>
          </div>

          <div
            v-if="formattedCast.length === 0"
            class="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800/40 text-gray-500 text-sm"
          >
            Aucune voix off enregistrée pour le moment.
          </div>

          <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            <div
              v-for="item in formattedCast"
              :key="item.work_id"
              class="bg-gray-900/80 border border-gray-800/80 rounded-2xl p-4 flex gap-4 items-center hover:border-gray-700 transition-colors group shadow-md"
            >
              <NuxtLink
                :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                class="relative w-14 h-14 rounded-full overflow-hidden bg-gray-800 shrink-0 border border-gray-700 group-hover:border-emerald-500 transition-colors flex items-center justify-center"
              >
                <NuxtImg
                  v-if="item.profile_picture"
                  :src="item.profile_picture"
                  :alt="item.firstname + ' ' + item.lastname"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <span v-else class="text-sm font-bold text-gray-400">
                  {{ item.firstname?.[0] }}{{ item.lastname?.[0] }}
                </span>
              </NuxtLink>

              <div class="flex-1 min-w-0">
                <NuxtLink
                  :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                  class="text-sm font-bold text-white hover:text-emerald-400 transition-colors truncate block"
                >
                  {{ item.firstname }} {{ item.lastname }}
                </NuxtLink>
                <span class="text-xs text-gray-400 block truncate mt-0.5">
                  {{ item.character_name || item.performance || "Voix off" }}
                </span>
              </div>
            </div>
          </div>
        </section>
      </template>
    </MediaDetailsLayout>

    <div v-else class="text-center py-24 text-gray-500">
      Publicité introuvable.
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import MediaSkeleton from "../../components/MediaSkeleton.vue";
import MediaDetailsLayout from "../../components/layout/MediaDetailsLayout.vue";
import ReportModal from "../../components/ReportModal.vue";
import { fetchAdvertisementData } from "@app/shared-logic";
import type { Advertisement, AdvertisementResponse } from "@app/shared-logic";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const user = useSupabaseUser();
const isAdmin = computed(() => {
  return (
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin"
  );
});

const adId = computed(() => {
  const idParam = route.params.id;
  const num = parseInt(idParam as string, 10);
  return isNaN(num) ? 0 : num;
});

const isReportModalOpen = ref(false);
const currentUrl = computed(() => route.fullPath);

// Instant Hydration Data Fetching
const { data, pending } = await useAsyncData(
  `ad-${adId.value}-${locale.value}`,
  () => fetchAdvertisementData(adId.value, locale.value),
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const advertisement = computed<Advertisement | null>(
  () => data.value?.advertisement || null,
);
const dubbingProjects = computed(() => data.value?.dubbingProjects || []);

const activeDubId = computed(() => {
  if (route.query.dub) {
    return Number(route.query.dub);
  }
  return dubbingProjects.value[0]?.id || 0;
});

const activeDubProject = computed(() => {
  return (
    dubbingProjects.value.find((p: any) => p.id === activeDubId.value) ||
    dubbingProjects.value[0] ||
    null
  );
});

const posterUrl = computed(() => {
  return advertisement.value?.poster_url || null;
});

function resolveProfilePicture(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://supabase.dubbingbase.com/storage/v1/object/public/voice-actors/${path}`;
}

interface FormattedCastItem {
  work_id: number;
  voice_actor_id: number;
  firstname: string;
  lastname: string;
  character_name?: string;
  performance?: string;
  profile_picture?: string | null;
}

const formattedCast = computed<FormattedCastItem[]>(() => {
  if (!activeDubProject.value || !activeDubProject.value.work) return [];
  return (activeDubProject.value.work || []).map((w: any) => ({
    work_id: w.id,
    voice_actor_id: w.voice_actors?.id || w.voice_actor_id,
    firstname: w.voice_actors?.firstname || "",
    lastname: w.voice_actors?.lastname || "",
    character_name: w.character_name || "",
    performance: w.performance || "",
    profile_picture: resolveProfilePicture(w.voice_actors?.profile_picture),
  }));
});

useHead({
  title: computed(() =>
    advertisement.value
      ? `${advertisement.value.title} - Voix Off | DubbingBase`
      : "Publicité | DubbingBase",
  ),
  meta: [
    {
      name: "description",
      content: computed(
        () =>
          advertisement.value?.description?.substring(0, 160) ||
          "Retrouvez les voix off et comédiens de cette publicité sur DubbingBase.",
      ),
    },
  ],
});
</script>
