<template>
  <div class="min-h-screen">
    <!-- Skeleton loader during SSR/fetch -->
    <MediaSkeleton v-if="pending && !data" />

    <!-- Main Content -->
    <MediaDetailsLayout
      v-else-if="toy"
      :backdrop-src="null"
      :poster-src="coverUrl"
      :title="toy.name"
      :original-title="toy.manufacturer"
      :media-type="'toy'"
      :release-year="toy.release_year ? String(toy.release_year) : undefined"
      :overview="toy.description"
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
                  ? `/toy/${toy.id}/projects/${activeDubProject.id}/edit`
                  : `/toy/${toy.id}/projects/new`,
              )
            "
            class="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 theme-status-warning-text text-xs font-semibold rounded-xl border border-amber-500/30 flex items-center gap-1.5 transition-colors"
          >
            <span>{{
              activeDubProject ? "Modifier le projet" : "Ajouter un projet"
            }}</span>
          </NuxtLink>

          <ForceEnqueueButton
            v-if="toy?.id"
            media-type="toy"
            :media-id="toy.id"
          />
        </div>
      </template>

      <template #details-extra>
        <div
          class="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t theme-border"
        >
          <div v-if="toy.manufacturer">
            <span class="text-xs theme-text-muted block mb-0.5">{{
              $t("toy.manufacturerLabel")
            }}</span>
            <span class="text-sm font-semibold theme-text">{{
              toy.manufacturer
            }}</span>
          </div>

          <div v-if="toy.product_line">
            <span class="text-xs theme-text-muted block mb-0.5">{{
              $t("toy.productLine")
            }}</span>
            <span class="text-sm font-semibold theme-text">{{
              toy.product_line
            }}</span>
          </div>

          <div v-if="toy.release_year">
            <span class="text-xs theme-text-muted block mb-0.5">{{
              $t("toy.releaseYear")
            }}</span>
            <span class="text-sm font-semibold theme-text">{{
              toy.release_year
            }}</span>
          </div>
        </div>
      </template>

      <!-- Technical Crew / Studio Section -->
      <template #crew-section>
        <div
          v-if="
            activeDubProject?.studios ||
            activeDubProject?.dubbing_project_crew?.length
          "
          class="theme-surface-overlay backdrop-blur border theme-border rounded-2xl p-6 space-y-4 mb-8 shadow-xl"
        >
          <h3
            class="text-xs font-bold theme-text-muted uppercase tracking-wider"
          >
            {{ $t("toy.studioAndProduction") }}
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div v-if="activeDubProject?.studios" class="space-y-1">
              <span class="text-xs theme-text-muted">{{
                $t("toyEditor.studioManufacturer")
              }}</span>
              <NuxtLink
                :to="localePath(`/studio/${activeDubProject.studios.id}`)"
                class="text-sm font-semibold theme-status-warning-text hover:underline block"
              >
                {{ activeDubProject.studios.name }}
              </NuxtLink>
            </div>

            <div
              v-for="member in activeDubProject?.dubbing_project_crew || []"
              :key="member.id"
              class="space-y-1"
            >
              <span class="text-xs theme-text-muted">{{
                member.jobs?.name || "Équipe"
              }}</span>
              <NuxtLink
                v-if="member.voice_actors"
                :to="localePath(`/voice-actor/${member.voice_actors.id}`)"
                class="text-sm font-semibold text-white hover:underline block"
              >
                {{ member.voice_actors.firstname }}
                {{ member.voice_actors.lastname }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </template>

      <!-- Cast Roster Section -->
      <template #cast-section>
        <section class="space-y-6">
          <div
            class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
          >
            <div>
              <h2 class="text-xl font-bold text-white flex items-center gap-2">
                <span>{{ $t("toyEditor.voiceNarrators") }}</span>
                <span
                  v-if="formattedCast.length > 0"
                  class="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 theme-status-warning-text font-semibold border border-amber-500/20"
                >
                  {{ formattedCast.length }}
                </span>
              </h2>
              <p class="text-xs theme-text-muted mt-1">
                {{ $t("toy.voiceCastDescription") }}
              </p>
            </div>
          </div>

          <div
            v-if="formattedCast.length === 0"
            class="text-center py-16 theme-surface-overlay rounded-2xl border theme-border theme-text-muted text-sm"
          >
            {{ $t("toy.noVoicesYet") }}
          </div>

          <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            <div
              v-for="item in formattedCast"
              :key="item.work_id"
              class="theme-surface-overlay border theme-border rounded-2xl p-4 flex gap-4 items-center theme-hover-border transition-colors group shadow-md"
            >
              <NuxtLink
                :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                class="relative w-14 h-14 rounded-full overflow-hidden theme-surface-muted shrink-0 border theme-border group-hover:border-amber-500 transition-colors flex items-center justify-center"
              >
                <NuxtImg
                  v-if="item.profile_picture"
                  :src="item.profile_picture"
                  :alt="item.firstname + ' ' + item.lastname"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <span v-else class="text-sm font-bold theme-text-muted">
                  {{ item.firstname?.[0] }}{{ item.lastname?.[0] }}
                </span>
              </NuxtLink>

              <div class="flex-1 min-w-0">
                <NuxtLink
                  :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                  class="text-sm font-bold text-white theme-status-warning-text transition-colors truncate block"
                >
                  {{ item.firstname }} {{ item.lastname }}
                </NuxtLink>
                <span class="text-xs theme-text-muted block truncate mt-0.5">
                  {{
                    item.character_name ||
                    item.performance ||
                    "Voix / Personnage"
                  }}
                </span>
                <span
                  v-if="item.note"
                  class="text-xs theme-text-muted block truncate mt-1"
                  >{{ item.note }}</span
                >
              </div>
            </div>
          </div>
        </section>
      </template>
    </MediaDetailsLayout>

    <div v-else class="text-center py-24 theme-text-muted">
      {{ $t("toy.notFound") }}
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
import { fetchToyData } from "@app/shared-logic";
import type { Toy, ToyResponse } from "@app/shared-logic";

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

const toyId = computed(() => {
  const idParam = route.params.id;
  const num = parseInt(idParam as string, 10);
  return isNaN(num) ? 0 : num;
});

const isReportModalOpen = ref(false);
const currentUrl = computed(() => route.fullPath);

// Instant Hydration Data Fetching
const { data, pending } = await useAsyncData(
  `toy-${toyId.value}-${locale.value}`,
  () => fetchToyData(toyId.value, locale.value),
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const toy = computed<Toy | null>(() => data.value?.toy || null);
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

const coverUrl = computed(() => {
  return toy.value?.cover_url || null;
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
  note?: string;
  profile_picture?: string | null;
}

const formattedCast = computed<FormattedCastItem[]>(() => {
  if (!activeDubProject.value) return [];
  const works =
    activeDubProject.value.works || activeDubProject.value.work || [];
  return works.map((w: any) => ({
    work_id: w.id,
    voice_actor_id: w.voice_actors?.id || w.voice_actor_id,
    firstname: w.voice_actors?.firstname || "",
    lastname: w.voice_actors?.lastname || "",
    character_name: w.character_name || "",
    performance: w.performance || "",
    note: w.note || "",
    profile_picture: resolveProfilePicture(w.voice_actors?.profile_picture),
  }));
});

useHead({
  title: computed(() =>
    toy.value
      ? `${toy.value.name} - Voix & Narrateurs | DubbingBase`
      : "Jouet Connecté / Conteuse | DubbingBase",
  ),
  meta: [
    {
      name: "description",
      content: computed(
        () =>
          toy.value?.description?.substring(0, 160) ||
          "Retrouvez toutes les voix et narrations de ce jouet connecté sur DubbingBase.",
      ),
    },
  ],
});
</script>
