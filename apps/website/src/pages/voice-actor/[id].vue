<template>
  <div class="max-w-7xl mx-auto p-6">
    <div v-if="loading" class="flex justify-center items-center h-64">
      <div
        class="w-12 h-12 border-4 border-gray-800 border-t-cyan-500 rounded-full animate-spin"
      ></div>
    </div>

    <div v-else-if="voiceActor" class="space-y-12 relative pt-12">


      <!-- Profile Header -->
      <section class="flex flex-col md:flex-row gap-8 items-start">
        <div
          class="w-48 h-48 md:w-64 md:h-64 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] shadow-2xl"
        >
          <NuxtImg format="webp"             v-if="profilePicture"
            :src="profilePicture"
            :alt="voiceActor.firstname + ' ' + voiceActor.lastname"
            class="object-cover w-full h-full"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-[#161616] text-gray-400 text-6xl font-bold uppercase"
          >
            {{ voiceActor.firstname?.[0] }}{{ voiceActor.lastname?.[0] }}
          </div>
        </div>

        <div class="flex-1 space-y-4">
          <h1 class="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            {{ voiceActor.firstname }} {{ voiceActor.lastname }}
          </h1>
          <div class="flex flex-wrap gap-3">
            <span
              v-if="voiceActor.nationality"
              class="px-3 py-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 rounded-full text-sm"
              >{{ voiceActor.nationality }}</span
            >
            <span
              v-if="voiceActor.date_of_birth"
              class="px-3 py-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 rounded-full text-sm"
              >Born:
              {{ new Date(voiceActor.date_of_birth).getFullYear() }}</span
            >
            <span
              v-if="voiceActor.years_active"
              class="px-3 py-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 rounded-full text-sm"
              >Active: {{ voiceActor.years_active }}</span
            >
          </div>

          <div
            v-if="voiceActor.bio"
            class="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 mt-6 bg-white dark:bg-[#161616] p-6 rounded-2xl border border-gray-200 dark:border-[#2a2a2a]"
          >
            <p class="leading-relaxed whitespace-pre-wrap">
              {{ voiceActor.bio }}
            </p>
          </div>
          <div class="pt-4 flex justify-end">
            <button @click="isReportModalOpen = true" class="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              {{ t('report.button', 'Signaler cette fiche') }}
            </button>
          </div>
        </div>
      </section>

      <!-- Global Search -->
      <div class="w-full relative max-w-xl mb-6">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search roles, titles or actors..."
          class="w-full px-4 py-3 pl-12 bg-white/80 dark:bg-[#161616]/80 backdrop-blur border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition shadow-sm"
        />
        <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      </div>

      <!-- Search Works -->
      <section>
        <div
          class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        >
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Filmography</h2>

          <div class="flex flex-wrap gap-4 items-center">
            <!-- Display Mode Toggle -->
            <div class="flex bg-gray-100 dark:bg-[#161616] rounded-lg p-1 border border-gray-200 dark:border-[#2a2a2a]">
              <button 
                @click="displayMode = 'grouped'" 
                :class="['px-4 py-1.5 rounded-md text-sm font-medium transition', displayMode === 'grouped' ? 'bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200']"
              >
                Grouped
              </button>
              <button 
                @click="displayMode = 'list'" 
                :class="['px-4 py-1.5 rounded-md text-sm font-medium transition', displayMode === 'list' ? 'bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200']"
              >
                List
              </button>
            </div>

            <!-- Sort Dropdown -->
            <select
              v-model="sortMode"
              class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] text-gray-900 dark:text-gray-200 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        <div
          v-if="filteredEnhancedWork.length === 0"
          class="text-gray-500 text-center py-12 bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-[#2a2a2a]"
        >
          No works found for this actor.
        </div>

        <template v-if="displayMode === 'list'">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <NuxtLink
              :to="$localePath(`/${item.work.dubbing_projects?.content_type === 'tv' ? 'show' : 'movie'}/${item.media.id}`)"
              v-for="item in sortedWorks"
              :key="item.work.id"
              class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700 block group"
            >
              <div class="flex flex-col sm:grid sm:grid-cols-3 gap-4 h-full">
                <!-- Column 1: Media -->
                <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start">
                  <div class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 flex-shrink-0">
                    <NuxtImg format="webp" v-if="item.media.poster_path" :src="resolveImageUrl(item.media.poster_path)" :alt="(item.media as any).title || (item.media as any).name" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                      <ClapperboardIcon class="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                    </div>
                  </div>
                  <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">{{ new Date(item.sortDate).getFullYear() }}</span>
                    <span class="font-bold text-sm text-gray-900 dark:text-gray-100 leading-tight line-clamp-2" :title="(item.media as any).title || (item.media as any).name">{{ (item.media as any).title || (item.media as any).name }}</span>
                  </div>
                </div>

                <!-- Column 2: Original Actor -->
                <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-3 sm:pt-0">
                  <div class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 flex-shrink-0">
                    <NuxtImg format="webp" v-if="item.data.actor.profile_picture" :src="resolveImageUrl(item.data.actor.profile_picture)" :alt="item.data.actor.name" class="w-full h-full object-cover" />
                    <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                      <UserIcon class="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                    </div>
                  </div>
                  <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Voiced</span>
                    <span class="font-medium text-sm text-gray-700 dark:text-gray-300 leading-tight line-clamp-2">{{ item.data.actor.name }}</span>
                  </div>
                </div>

                <!-- Column 3: Character -->
                <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-3 sm:pt-0">
                  <div class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 relative flex-shrink-0">
                    <NuxtImg format="webp" v-if="item.data.characterImage" :src="resolveImageUrl(item.data.characterImage)" :alt="item.data.character" class="w-full h-full object-cover" />
                    <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                      <UserIcon class="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                    </div>
                    <div v-if="item.work.performance" class="absolute bottom-1 left-1 right-1 flex justify-center">
                       <span class="bg-black/70 backdrop-blur text-white text-[9px] px-2 py-0.5 rounded-full truncate max-w-full font-medium">{{ item.work.performance }}</span>
                    </div>
                  </div>
                  <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">As</span>
                    <span class="font-medium text-sm text-gray-700 dark:text-gray-300 leading-tight line-clamp-2">{{ item.data.character || 'Unknown' }}</span>
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>
        </template>
        <template v-else>
          <div class="space-y-10">
            <div
              v-for="[actorName, works] in groupedWorks"
              :key="actorName"
              class="space-y-4"
            >
              <!-- Actor Group Header -->
              <NuxtLink :to="$localePath(`/actor/${works[0]?.data.actor.id}`)" class="flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4 hover:bg-gray-50 dark:hover:bg-[#1d1d1d] p-2 -ml-2 rounded-xl transition-colors cursor-pointer group">
                <div class="w-14 h-14 rounded-full overflow-hidden bg-gray-100 dark:bg-[#161616] shadow-md border border-gray-200 dark:border-[#2a2a2a]">
                  <NuxtImg format="webp" v-if="works[0]?.data.actor.profile_picture" :src="resolveImageUrl(works[0].data.actor.profile_picture)" :alt="actorName" class="object-cover w-full h-full" />
                  <UserIcon v-else class="w-full h-full text-gray-400 p-2" />
                </div>
                <div>
                  <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:underline">
                    {{ actorName }}
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ works.length }} works</p>
                </div>
              </NuxtLink>

              <!-- Actor Works Grid -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <NuxtLink
                  :to="$localePath(`/${item.work.dubbing_projects?.content_type === 'tv' ? 'show' : 'movie'}/${item.media.id}`)"
                  v-for="item in works"
                  :key="item.work.id"
                  class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700 block group"
                >
                  <div class="flex flex-col sm:grid sm:grid-cols-2 gap-4 h-full">
                    <!-- Column 1: Media -->
                    <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start">
                      <div class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 flex-shrink-0">
                        <NuxtImg format="webp" v-if="item.media.poster_path" :src="resolveImageUrl(item.media.poster_path)" :alt="(item.media as any).title || (item.media as any).name" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                          <ClapperboardIcon class="w-6 h-6 opacity-20" />
                        </div>
                      </div>
                      <div class="flex flex-col min-w-0 flex-1">
                        <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">{{ new Date(item.sortDate).getFullYear() }}</span>
                        <span class="font-bold text-sm text-gray-900 dark:text-gray-100 leading-tight line-clamp-2" :title="(item.media as any).title || (item.media as any).name">{{ (item.media as any).title || (item.media as any).name }}</span>
                      </div>
                    </div>

                    <!-- Column 2: Character -->
                    <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-3 sm:pt-0">
                      <div class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 relative flex-shrink-0">
                        <NuxtImg format="webp" v-if="item.data.characterImage" :src="resolveImageUrl(item.data.characterImage)" :alt="item.data.character" class="w-full h-full object-cover" />
                        <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                          <UserIcon class="w-6 h-6 opacity-20" />
                        </div>
                        <div v-if="item.work.performance" class="absolute bottom-1 left-1 right-1 flex justify-center">
                           <span class="bg-black/70 backdrop-blur text-white text-[9px] px-2 py-0.5 rounded-full truncate max-w-full font-medium">{{ item.work.performance }}</span>
                        </div>
                      </div>
                      <div class="flex flex-col min-w-0 flex-1">
                        <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">As</span>
                        <span class="font-medium text-sm text-gray-700 dark:text-gray-300 leading-tight line-clamp-2">{{ item.data.character || 'Unknown' }}</span>
                      </div>
                    </div>
                  </div>
                </NuxtLink>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <div v-else class="text-center py-20 text-gray-500">Actor not found.</div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import { useVoiceActorData, fetchVoiceActorData } from '@app/shared-logic';
import { useRouter } from 'vue-router';
import { ArrowLeftIcon } from 'lucide-vue-next';
import ReportModal from '../../components/ReportModal.vue';

const isReportModalOpen = ref(false);

const supabase = useSupabaseClient();
const router = useRouter();

const route = useRoute();
const voiceActorId = Number(route.params.id);
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);
const { locale, t } = useI18n();

const config = useRuntimeConfig();
const baseUrl = config.public.supabase.url;

const { data } = await useAsyncData(`voice-actor-${voiceActorId}`, () => fetchVoiceActorData(supabase, voiceActorId));

const {
  voiceActor,
  profilePicture,
  loading,
  searchQuery,
  filteredEnhancedWork,
} = useVoiceActorData(supabase, data.value);

const actorName = computed(() => {
  if (!voiceActor.value) return '';
  return voiceActor.value.voice_actor_name || `${voiceActor.value.firstname} ${voiceActor.value.lastname}`;
});

const canonicalUrl = computed(() => `https://dubbingbase.com/voice-actor/${voiceActorId}`);

const ogImageUrl = computed(() => {
  if (!voiceActorId) return '';
  return `${baseUrl}/functions/v1/og-image?type=voice-actor&id=${voiceActorId}`;
});
const actorDescription = computed(() => {
  if (!actorName.value) return 'Fiche comédien de doublage sur DubbingBase.';
  const workCount = voiceActor.value?.work?.length || 0;
  return `Consultez la fiche complète de ${actorName.value}, comédien de doublage. Retrouvez ses ${workCount} rôles et doublages célèbres sur DubbingBase.`;
});

// Complete SEO metadata & JSON-LD Structured Data using unhead
useHead({
  titleTemplate: null,
  title: computed(() => actorName.value ? `${actorName.value} - Comédien de doublage` : 'Comédien de doublage'),
  meta: [
    {
      name: 'description',
      content: actorDescription,
    },
    {
      name: 'keywords',
      content: computed(() => {
        const name = actorName.value || '';
        if (!name) return t('home.meta.keywords');
        return t('seo.voiceActorKeywords', { name });
      }),
    },
    { name: 'robots', content: 'index, follow' },
    // Open Graph
    { property: 'og:title', content: computed(() => actorName.value ? `${actorName.value} - Comédien de doublage` : 'DubbingBase') },
    { property: 'og:description', content: actorDescription },
    { property: 'og:type', content: 'profile' },
    { property: 'og:locale', content: computed(() => {
      return locale.value === 'fr' ? 'fr_FR' : 'en_US';
    }) },
    { property: 'og:logo', content: 'https://dubbingbase.com/logo.png' },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:image', content: ogImageUrl },
    { property: 'og:site_name', content: 'DubbingBase' },
    // Twitter Card
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: computed(() => actorName.value ? `${actorName.value} - Comédien de doublage` : 'DubbingBase') },
    { name: 'twitter:description', content: actorDescription },
    { name: 'twitter:image', content: ogImageUrl },
  ],
  link: [
    { rel: 'canonical', href: canonicalUrl },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() => JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        url: canonicalUrl.value,
        name: actorName.value ? `${actorName.value} - Fiche Comédien` : 'Fiche Comédien',
        mainEntity: {
          '@type': 'Person',
          name: actorName.value || 'Comédien de doublage',
          jobTitle: 'Comédien de doublage',
          image: profilePicture.value || ogImageUrl.value,
          url: canonicalUrl.value,
        },
      })),
    },
  ],
});

const displayMode = ref<'grouped' | 'list'>('grouped');
const sortMode = ref<'newest' | 'oldest'>('newest');

const resolveImageUrl = (path: string | undefined | null) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w185${path}`;
};

const sortedWorks = computed(() => {
  const works = [...filteredEnhancedWork.value];
  if (sortMode.value === "oldest") {
    return works.sort((a, b) => (a.sortDate > b.sortDate ? 1 : -1));
  }
  return works.sort((a, b) => (a.sortDate > b.sortDate ? -1 : 1));
});

const groupedWorks = computed(() => {
  const map = new Map<string, typeof sortedWorks.value>();
  for (const item of sortedWorks.value) {
    const actorName = item.data.actor.name || "Unknown Actor";
    if (!map.has(actorName)) {
      map.set(actorName, []);
    }
    map.get(actorName)!.push(item);
  }

  return Array.from(map.entries()).sort((a, b) => {
    // Sort by number of works, then alphabetically
    if (b[1].length !== a[1].length) {
      return b[1].length - a[1].length;
    }
    return a[0].localeCompare(b[0]);
  });
});

</script>
