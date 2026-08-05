<template>
  <div class="max-w-7xl mx-auto p-6">
    <div v-if="loading" class="flex justify-center items-center h-64">
      <div
        class="w-12 h-12 border-4 border-gray-800 border-t-cyan-500 rounded-full animate-spin"
      ></div>
    </div>

    <div v-else-if="actor" class="space-y-12 relative pt-12">
      <!-- Back Button -->
      <button @click="router.back()" class="absolute top-0 left-0 z-20 flex items-center gap-2 bg-white/80 dark:bg-[#161616]/80 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] backdrop-blur-sm text-gray-900 dark:text-white px-4 py-2 rounded-full transition-colors border border-gray-200 dark:border-[#2a2a2a] shadow-md">
        <ArrowLeftIcon class="w-5 h-5" />
        <span class="font-medium">Retour</span>
      </button>

      <!-- Profile Header -->
      <section class="flex flex-col md:flex-row gap-8 items-start">
        <div
          class="w-48 h-48 md:w-64 md:h-64 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] shadow-2xl"
        >
          <NuxtImg format="webp"             v-if="actor.profile_path"
            :src="resolveImageUrl(actor.profile_path)"
            :alt="actor.name"
            class="object-cover w-full h-full"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-[#161616] text-gray-400 text-6xl font-bold uppercase"
          >
            {{ actor.name?.[0] }}
          </div>
        </div>

        <div class="flex-1 space-y-4">
          <h1 class="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            {{ actor.name }}
          </h1>
          <div class="flex flex-wrap gap-3">
            <span
              v-if="actor.place_of_birth"
              class="px-3 py-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 rounded-full text-sm"
              >{{ actor.place_of_birth }}</span
            >
            <span
              v-if="actor.birthday"
              class="px-3 py-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 rounded-full text-sm"
              >Born:
              {{ new Date(actor.birthday).getFullYear() }}</span
            >
            <span
              v-if="actor.deathday"
              class="px-3 py-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 rounded-full text-sm"
              >Died:
              {{ new Date(actor.deathday).getFullYear() }}</span
            >
          </div>

          <div
            v-if="actor.biography"
            class="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 mt-6 bg-white dark:bg-[#161616] p-6 rounded-2xl border border-gray-200 dark:border-[#2a2a2a]"
          >
            <p class="leading-relaxed whitespace-pre-wrap line-clamp-[10] hover:line-clamp-none transition-all">
              {{ actor.biography }}
            </p>
          </div>
        </div>
      </section>

      <!-- Global Search -->
      <div class="w-full relative max-w-xl mb-6">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search roles, titles or voice actors..."
          class="w-full px-4 py-3 pl-12 bg-white/80 dark:bg-[#161616]/80 backdrop-blur border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition shadow-sm"
        />
        <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      </div>

      <!-- French Voices Section -->
      <section v-if="filteredUniqueFrenchVoiceActors.length > 0">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">French Voices</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <NuxtLink
            v-for="va in filteredUniqueFrenchVoiceActors"
            :key="va.id"
            :to="$localePath(`/voice-actor/${va.id}`)"
            :class="[
              'flex flex-col items-center p-4 rounded-xl border transition group hover:-translate-y-1',
              va.highlight ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-500/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/40' : 'bg-white dark:bg-[#161616] border-gray-200 dark:border-[#2a2a2a] hover:bg-gray-50 dark:hover:bg-gray-800'
            ]"
          >
            <div class="relative w-20 h-20 rounded-full overflow-hidden mb-3 border-2 border-transparent group-hover:border-cyan-400 transition-colors">
              <NuxtImg format="webp"                 v-if="va.profile_picture"
                :src="va.profile_picture"
                :alt="`${va.firstname} ${va.lastname}`"
                class="object-cover w-full h-full"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-400 font-bold"
              >
                {{ va.firstname?.[0] }}{{ va.lastname?.[0] }}
              </div>
            </div>
            <h3 class="font-bold text-center text-sm text-gray-900 dark:text-gray-200">
              {{ va.firstname }} {{ va.lastname }}
            </h3>
            <span class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ va.rolesCount }} roles</span>
          </NuxtLink>
        </div>
      </section>

      <!-- Filmography Section -->
      <section>
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Filmography</h2>
        </div>

        <div
          v-if="filteredCredits.length === 0"
          class="text-gray-500 text-center py-12 bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-[#2a2a2a]"
        >
          No works found.
        </div>
        
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <NuxtLink
            :to="$localePath(`/${item.media_type === 'tv' ? 'show' : 'movie'}/${item.id}`)"
            v-for="item in filteredCredits"
            :key="`${item.media_type}-${item.id}`"
            class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700 block group"
          >
            <div class="flex gap-4 h-full">
              <!-- Media Poster -->
              <div class="w-20 md:w-24 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 aspect-[2/3]">
                <NuxtImg format="webp"                   v-if="item.poster_path"
                  :src="resolveImageUrl(item.poster_path)"
                  :alt="item.title || item.name"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                  <ClapperboardIcon class="w-8 h-8 opacity-20" />
                </div>
              </div>
              
              <!-- Info -->
              <div class="flex flex-col flex-1 min-w-0 py-1">
                <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">
                  {{ item.release_date ? new Date(item.release_date).getFullYear() : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : 'N/A') }}
                </span>
                <h3 class="font-bold text-base text-gray-900 dark:text-gray-100 leading-tight line-clamp-2 mb-2" :title="item.title || item.name">
                  {{ item.title || item.name }}
                </h3>
                
                <div class="mt-auto pt-3 border-t border-gray-100 dark:border-[#2a2a2a]">
                  <p class="text-sm text-gray-700 dark:text-gray-300 truncate">
                    <span class="text-xs text-gray-500 uppercase font-medium mr-1">as</span>
                    {{ item.character || 'Unknown' }}
                  </p>
                </div>
              </div>
            </div>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeftIcon, ClapperboardIcon } from "lucide-vue-next";
import { useActorData } from "@app/shared-logic";

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();

const id = route.params.id as string;

const {
  actor,
  loading,
  searchQuery,
  filteredCredits,
  uniqueFrenchVoiceActors,
  filteredUniqueFrenchVoiceActors,
  loadActorData,
} = useActorData(supabase);

onMounted(async () => {
  if (id) {
    await loadActorData(id);
  }
});

// Update page metadata when actor data loads
watch(
  actor,
  (newActor) => {
    if (newActor) {
      useHead({
        title: `${newActor.name} - DubbingBase`,
        meta: [
          {
            name: "description",
            content: newActor.biography || `Discover ${newActor.name}'s filmography and French voice actors on DubbingBase.`,
          },
          { property: "og:title", content: `${newActor.name} - DubbingBase` },
          {
            property: "og:description",
            content: newActor.biography || `Discover ${newActor.name}'s filmography and French voice actors on DubbingBase.`,
          },
          {
            property: "og:image",
            content: newActor.profile_path ? resolveImageUrl(newActor.profile_path) : 'https://dubbingbase.com/default-og.jpg',
          },
        ],
        script: [
          {
            type: 'application/ld+json',
            innerHTML: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Person',
              url: `https://dubbingbase.com/actor/${id}`,
              name: newActor.name,
              image: newActor.profile_path ? resolveImageUrl(newActor.profile_path) : '',
              description: newActor.biography || `Discover ${newActor.name}'s filmography and French voice actors on DubbingBase.`,
            })
          }
        ]
      });
    }
  },
  { immediate: true },
);

function resolveImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w342${path}`;
}
</script>
