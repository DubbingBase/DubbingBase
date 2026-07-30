<template>
  <div class="max-w-7xl mx-auto p-6">
    <div v-if="loading" class="flex justify-center items-center h-64">
      <div
        class="w-12 h-12 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin"
      ></div>
    </div>

    <div v-else-if="actor" class="space-y-12 relative pt-12">
      <!-- Back Button -->
      <button @click="router.back()" class="absolute top-0 left-0 z-20 flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700 backdrop-blur-sm text-white px-4 py-2 rounded-full transition-colors border border-gray-600 shadow-md">
        <ArrowLeftIcon class="w-5 h-5" />
        <span class="font-medium">Retour</span>
      </button>

      <!-- Profile Header -->
      <section class="flex flex-col md:flex-row gap-8 items-start">
        <div
          class="w-48 h-48 md:w-64 md:h-64 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-800 border border-gray-700 shadow-2xl"
        >
          <img
            v-if="actor.profile_path"
            :src="resolveImageUrl(actor.profile_path)"
            :alt="actor.name"
            class="object-cover w-full h-full"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center bg-gray-700 text-gray-400 text-6xl font-bold uppercase"
          >
            {{ actor.name?.[0] }}
          </div>
        </div>

        <div class="flex-1 space-y-4">
          <h1 class="text-4xl md:text-5xl font-bold text-white">
            {{ actor.name }}
          </h1>
          <div class="flex flex-wrap gap-3">
            <span
              v-if="actor.place_of_birth"
              class="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm"
              >{{ actor.place_of_birth }}</span
            >
            <span
              v-if="actor.birthday"
              class="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm"
              >Born:
              {{ new Date(actor.birthday).getFullYear() }}</span
            >
            <span
              v-if="actor.deathday"
              class="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm"
              >Died:
              {{ new Date(actor.deathday).getFullYear() }}</span
            >
          </div>

          <div
            v-if="actor.biography"
            class="prose prose-invert max-w-none text-gray-300 mt-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-800"
          >
            <p class="leading-relaxed whitespace-pre-wrap line-clamp-[10] hover:line-clamp-none transition-all">
              {{ actor.biography }}
            </p>
          </div>
        </div>
      </section>

      <!-- French Voices Section -->
      <section v-if="uniqueFrenchVoiceActors.length > 0">
        <h2 class="text-2xl font-bold text-white mb-6">French Voices</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <NuxtLink
            v-for="va in uniqueFrenchVoiceActors"
            :key="va.id"
            :to="`/voice-actor/${va.id}`"
            :class="[
              'flex flex-col items-center p-4 rounded-xl border transition group hover:-translate-y-1',
              va.highlight ? 'bg-blue-900/20 border-blue-500/50 hover:bg-blue-900/40' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700'
            ]"
          >
            <div class="relative w-20 h-20 rounded-full overflow-hidden mb-3 border-2 border-transparent group-hover:border-blue-400 transition-colors">
              <img
                v-if="va.profile_picture"
                :src="va.profile_picture"
                :alt="`${va.firstname} ${va.lastname}`"
                class="object-cover w-full h-full"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center bg-gray-600 text-gray-300 font-bold"
              >
                {{ va.firstname?.[0] }}{{ va.lastname?.[0] }}
              </div>
            </div>
            <h3 class="font-bold text-center text-sm text-gray-200">
              {{ va.firstname }} {{ va.lastname }}
            </h3>
            <span class="text-xs text-gray-400 mt-1">{{ va.rolesCount }} roles</span>
          </NuxtLink>
        </div>
      </section>

      <!-- Filmography Section -->
      <section>
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <h2 class="text-2xl font-bold text-white">Filmography</h2>

          <div class="flex flex-wrap gap-4 items-center">
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
          v-if="filteredCredits.length === 0"
          class="text-gray-500 text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800"
        >
          No works found.
        </div>
        
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            :to="`/${item.media_type === 'tv' ? 'show' : 'movie'}/${item.id}`"
            v-for="item in filteredCredits"
            :key="`${item.media_type}-${item.id}`"
            class="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 hover:bg-gray-800 transition duration-300 flex flex-col gap-4 shadow-sm block group"
          >
            <!-- Media Info -->
            <div class="flex gap-4">
              <div class="w-16 h-24 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                <img
                  v-if="item.poster_path"
                  :src="resolveImageUrl(item.poster_path)"
                  :alt="item.title || item.name"
                  class="object-cover w-full h-full group-hover:scale-105 transition-transform"
                />
              </div>
              <div class="flex flex-col justify-center flex-1 min-w-0">
                <h3
                  class="font-bold text-gray-100 line-clamp-2 mb-1"
                  :title="item.title || item.name"
                >
                  {{ item.title || item.name }}
                </h3>
                <div class="text-sm text-gray-400">
                  {{ item.release_date ? new Date(item.release_date).getFullYear() : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : 'N/A') }}
                </div>
              </div>
            </div>

            <!-- Role info -->
            <div class="bg-gray-900/50 rounded-xl p-3 border border-gray-800/50">
              <p class="text-sm text-gray-300 truncate" :title="item.character">
                <span class="text-gray-500">as</span> {{ item.character || 'Unknown Role' }}
              </p>
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
import { ArrowLeftIcon } from "lucide-vue-next";
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
