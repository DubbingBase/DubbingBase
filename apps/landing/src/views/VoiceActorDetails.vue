<template>
  <div class="max-w-7xl mx-auto p-6">
    <header
      class="flex justify-between items-center mb-8 py-6 border-b border-gray-800"
    >
      <h1
        class="text-3xl font-extrabold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent cursor-pointer"
        @click="$router.push('/')"
      >
        DubbingBase
      </h1>
      <nav>
        <router-link to="/" class="text-gray-300 hover:text-white transition"
          >Home</router-link
        >
      </nav>
    </header>

    <div v-if="loading" class="flex justify-center items-center h-64">
      <div
        class="w-12 h-12 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin"
      ></div>
    </div>

    <div v-else-if="voiceActor" class="space-y-12">
      <!-- Profile Header -->
      <section class="flex flex-col md:flex-row gap-8 items-start">
        <div
          class="w-48 h-48 md:w-64 md:h-64 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-800 border border-gray-700 shadow-2xl"
        >
          <img
            v-if="profilePicture"
            :src="profilePicture"
            :alt="voiceActor.firstname + ' ' + voiceActor.lastname"
            class="object-cover w-full h-full"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center bg-gray-700 text-gray-400 text-6xl font-bold uppercase"
          >
            {{ voiceActor.firstname?.[0] }}{{ voiceActor.lastname?.[0] }}
          </div>
        </div>

        <div class="flex-1 space-y-4">
          <h1 class="text-4xl md:text-5xl font-bold text-white">
            {{ voiceActor.firstname }} {{ voiceActor.lastname }}
          </h1>
          <div class="flex flex-wrap gap-3">
            <span
              v-if="voiceActor.nationality"
              class="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm"
              >{{ voiceActor.nationality }}</span
            >
            <span
              v-if="voiceActor.date_of_birth"
              class="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm"
              >Born:
              {{ new Date(voiceActor.date_of_birth).getFullYear() }}</span
            >
            <span
              v-if="voiceActor.years_active"
              class="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm"
              >Active: {{ voiceActor.years_active }}</span
            >
          </div>

          <div
            v-if="voiceActor.bio"
            class="prose prose-invert max-w-none text-gray-300 mt-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-800"
          >
            <p class="leading-relaxed whitespace-pre-wrap">
              {{ voiceActor.bio }}
            </p>
          </div>
        </div>
      </section>

      <!-- Search Works -->
      <section>
        <div
          class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        >
          <h2 class="text-2xl font-bold text-white">Filmography</h2>

          <div class="flex flex-wrap gap-4 items-center">
            <!-- Display Mode Toggle -->
            <div class="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
              <button 
                @click="displayMode = 'grouped'" 
                :class="['px-4 py-1.5 rounded-md text-sm font-medium transition', displayMode === 'grouped' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200']"
              >
                Grouped
              </button>
              <button 
                @click="displayMode = 'list'" 
                :class="['px-4 py-1.5 rounded-md text-sm font-medium transition', displayMode === 'list' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200']"
              >
                List
              </button>
            </div>

            <!-- Sort Dropdown -->
            <select
              v-model="sortMode"
              class="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

            <!-- Search -->
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search roles or titles..."
              class="w-full md:w-64 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </div>

        <div
          v-if="filteredEnhancedWork.length === 0"
          class="text-gray-500 text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800"
        >
          No works found for this actor.
        </div>

        <template v-if="displayMode === 'list'">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="item in sortedWorks"
              :key="item.work.id"
              class="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 hover:bg-gray-800 transition duration-300 flex flex-col gap-4 shadow-sm"
            >
              <!-- Media Info -->
              <div class="flex gap-4">
                <div
                  class="w-16 h-24 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0"
                >
                  <img
                    v-if="item.media.poster_path"
                    :src="resolveImageUrl(item.media.poster_path)"
                    :alt="(item.media as any).title || (item.media as any).name"
                    class="object-cover w-full h-full"
                  />
                </div>
                <div class="flex flex-col justify-center flex-1 min-w-0">
                  <h3
                    class="font-bold text-gray-100 line-clamp-2 mb-1"
                    :title="
                      (item.media as any).title || (item.media as any).name
                    "
                  >
                    {{ (item.media as any).title || (item.media as any).name }}
                  </h3>
                  <div class="text-sm text-gray-400">
                    {{ new Date(item.sortDate).getFullYear() }}
                  </div>
                </div>
              </div>

              <!-- Character and Actor Info (Split) -->
              <div
                class="mt-auto flex justify-between items-center gap-2 bg-gray-900/50 p-3 rounded-xl border border-gray-800"
              >
                <!-- Physical Actor -->
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    class="w-16 h-16 rounded-full overflow-hidden bg-gray-700 flex-shrink-0 shadow-inner"
                  >
                    <img
                      v-if="item.data.actor.profile_picture"
                      :src="resolveImageUrl(item.data.actor.profile_picture)"
                      :alt="item.data.actor.name"
                      class="object-cover w-full h-full"
                    />
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      class="w-full h-full text-gray-500 p-2"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div
                      class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5"
                    >
                      Voiced
                    </div>
                    <div class="text-sm font-bold text-gray-100 truncate">
                      {{ item.data.actor.name }}
                    </div>
                  </div>
                </div>

                <!-- Character -->
                <div
                  class="flex items-center gap-2 flex-shrink-0 max-w-[50%]"
                  v-if="item.data.character"
                >
                  <div class="min-w-0 text-right">
                    <div class="text-xs text-gray-400 truncate">
                      as {{ item.data.character }}
                    </div>
                  </div>
                  <div
                    class="w-14 h-14 rounded-full overflow-hidden bg-gray-700 flex-shrink-0 border border-gray-600 shadow-sm"
                  >
                    <img
                      v-if="item.data.characterImage"
                      :src="resolveImageUrl(item.data.characterImage)"
                      :alt="item.data.character"
                      class="object-cover w-full h-full"
                    />
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      class="w-full h-full text-gray-500 p-1.5"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
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
              <div class="flex items-center gap-4 border-b border-gray-800 pb-4">
                <div class="w-14 h-14 rounded-full overflow-hidden bg-gray-700 shadow-md border border-gray-600">
                  <img v-if="works[0].data.actor.profile_picture" :src="resolveImageUrl(works[0].data.actor.profile_picture)" :alt="actorName" class="object-cover w-full h-full" />
                  <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-full h-full text-gray-500 p-2">
                    <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-gray-100">
                    {{ actorName }}
                  </h3>
                  <p class="text-sm text-gray-400">{{ works.length }} works</p>
                </div>
              </div>

              <!-- Actor Works Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div
                  v-for="item in works"
                  :key="item.work.id"
                  class="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 hover:bg-gray-800 transition duration-300 flex flex-col gap-4 shadow-sm"
                >
                  <!-- Media Info -->
                  <div class="flex gap-4 h-full items-center">
                    <div
                      class="w-16 h-24 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0"
                    >
                      <img
                        v-if="item.media.poster_path"
                        :src="resolveImageUrl(item.media.poster_path)"
                        :alt="
                          (item.media as any).title || (item.media as any).name
                        "
                        class="object-cover w-full h-full"
                      />
                    </div>
                    <div class="flex flex-col justify-center flex-1 min-w-0">
                      <h3
                        class="font-bold text-gray-100 line-clamp-2 mb-1"
                        :title="
                          (item.media as any).title || (item.media as any).name
                        "
                      >
                        {{
                          (item.media as any).title || (item.media as any).name
                        }}
                      </h3>
                      <div class="text-sm text-gray-400">
                        {{ new Date(item.sortDate).getFullYear() }}
                      </div>
                      <div v-if="item.data.character" class="mt-4 flex flex-col sm:flex-row items-center gap-3 bg-gray-800/90 px-4 py-3 rounded-xl self-start border border-gray-700 max-w-full shadow-sm">
                        <div class="w-14 h-14 rounded-full overflow-hidden bg-gray-700 flex-shrink-0 border border-gray-600 shadow-md">
                          <img v-if="item.data.characterImage" :src="resolveImageUrl(item.data.characterImage)" :alt="item.data.character" class="object-cover w-full h-full" />
                          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-full h-full text-gray-500 p-2">
                            <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" />
                          </svg>
                        </div>
                        <span class="text-xs font-medium text-gray-300 truncate"
                          >as {{ item.data.character }}</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <div v-else class="text-center py-20 text-gray-500">Actor not found.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useHead } from '@unhead/vue';
import { useRoute } from 'vue-router';
import { supabase } from '../api/supabase';
import { useVoiceActorData } from '@app/shared-logic';

const route = useRoute();
const voiceActorId = Number(route.params.id);

const {
  voiceActor,
  profilePicture,
  loading,
  searchQuery,
  filteredEnhancedWork,
  loadVoiceActorData,
} = useVoiceActorData(supabase);

const actorName = computed(() => {
  if (!voiceActor.value) return '';
  return voiceActor.value.voice_actor_name || `${voiceActor.value.firstname} ${voiceActor.value.lastname}`;
});

const canonicalUrl = computed(() => `https://dubbingbase.com/voice-actor/${voiceActorId}`);
const ogImageUrl = computed(() => {
  if (!voiceActorId) return '';
  const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
  return `${baseUrl}/functions/v1/og-image?type=voice-actor&id=${voiceActorId}`;
});
const actorDescription = computed(() => {
  if (!actorName.value) return 'Fiche comédien de doublage sur DubbingBase.';
  const workCount = filteredEnhancedWork.value.length;
  return `Consultez la fiche complète de ${actorName.value}, comédien de doublage. Retrouvez ses ${workCount} rôles et doublages célèbres sur DubbingBase.`;
});

// Complete SEO metadata & JSON-LD Structured Data using unhead
useHead({
  title: computed(() => actorName.value ? `${actorName.value} - Comédien de doublage | DubbingBase` : 'Comédien de doublage - DubbingBase'),
  meta: [
    {
      name: 'description',
      content: actorDescription,
    },
    {
      name: 'keywords',
      content: computed(() => `${actorName.value}, comédien de doublage, voix française, vf, doublage, filmographie`),
    },
    { name: 'robots', content: 'index, follow' },
    // Open Graph
    { property: 'og:title', content: computed(() => actorName.value ? `${actorName.value} - Comédien de doublage` : 'DubbingBase') },
    { property: 'og:description', content: actorDescription },
    { property: 'og:type', content: 'profile' },
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

onMounted(() => {
  const id = route.params.id as string;
  if (id) {
    loadVoiceActorData(id);
  }
});
</script>
