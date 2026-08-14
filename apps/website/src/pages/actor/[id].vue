<template>
  <div>
    <PersonSkeleton v-if="loading && !actor" />
    <PersonDetailsLayout
      v-else-if="actor"
      :name="actor.name"
      :profile-url="actor.profile_path ? resolveImageUrl(actor.profile_path) : null"
      :loading="loading"
    >
      <template #metadata>
        <span
          v-if="actor.place_of_birth"
          class="px-3 py-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 rounded-full text-sm"
          >{{ actor.place_of_birth }}</span
        >
        <span
          v-if="actor.birthday"
          class="text-gray-900 dark:text-gray-100 font-semibold text-base md:text-lg bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg"
          >Born: {{ actor.birthday.split('-')[0] }}</span>
        <span
          v-if="actor.deathday"
          class="text-gray-900 dark:text-gray-100 font-semibold text-base md:text-lg bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg"
          >Died: {{ actor.deathday.split('-')[0] }}</span>
      </template>

      <template #biography>
        <div
          v-if="actor.biography"
          class="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 mt-6 bg-white dark:bg-[#161616] p-6 rounded-2xl border border-gray-200 dark:border-[#2a2a2a]"
        >
          <p
            class="leading-relaxed whitespace-pre-wrap line-clamp-[10] hover:line-clamp-none transition-all"
          >
            {{ actor.biography }}
          </p>
        </div>
      </template>

      <template #actions>
        <button
          type="button"
          @click="isReportModalOpen = true"
          class="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
            />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          {{ t("report.button", "Signaler cette fiche") }}
        </button>
      </template>

      <template #content>
        <!-- Global Search -->
      <div class="w-full relative max-w-xl mb-6">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search roles, titles or voice actors..."
          class="w-full px-4 py-3 pl-12 bg-white/80 dark:bg-[#161616]/80 backdrop-blur border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition shadow-sm"
        />
        <svg
          class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          ></path>
        </svg>
      </div>

      <!-- Voices Section -->
      <section v-if="availableLanguages.length > 0">
        <div
          class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
        >
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            Voices
          </h2>
          <!-- Language Tabs -->
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              v-for="lang in availableLanguages"
              :key="lang"
              @click="selectedLanguage = lang"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
              :class="
                selectedLanguage === lang
                  ? 'bg-cyan-600 text-white border-cyan-600'
                  : 'bg-white dark:bg-[#161616] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#2a2a2a] hover:bg-gray-50 dark:hover:bg-gray-800'
              "
            >
              {{ getDisplayLanguage(lang) }}
            </button>
          </div>
        </div>

        <div
          v-if="filteredUniqueVoiceActorsByLanguage.length > 0"
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          <NuxtLink
            v-for="va in filteredUniqueVoiceActorsByLanguage"
            :key="va.id"
            :to="$localePath(`/voice-actor/${va.id}`)"
            :class="[
              'flex flex-col items-center p-4 rounded-xl border transition group hover:-translate-y-1',
              va.highlight
                ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-500/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/40'
                : 'bg-white dark:bg-[#161616] border-gray-200 dark:border-[#2a2a2a] hover:bg-gray-50 dark:hover:bg-gray-800',
            ]"
          >
            <div
              class="relative w-20 h-20 rounded-full overflow-hidden mb-3 border-2 border-transparent group-hover:border-cyan-400 transition-colors"
            >
              <NuxtImg
                format="webp" loading="lazy"
                v-if="va.profile_picture"
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
            <span
              class="block font-bold text-center text-sm text-gray-900 dark:text-gray-200"
            >
              {{ va.firstname }} {{ va.lastname }}
            </span>
            <span class="text-xs text-gray-500 dark:text-gray-400 mt-1"
              >{{ va.rolesCount }} roles</span
            >
          </NuxtLink>
        </div>
        <div
          v-else
          class="text-gray-500 text-center py-8 bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-[#2a2a2a]"
        >
          No voice actors found for the selected language.
        </div>
      </section>

      <!-- Filmography Section -->
      <section>
        <div
          class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        >
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            Filmography
          </h2>
        </div>

        <div
          v-if="enhancedFilmography.length === 0"
          class="text-gray-500 text-center py-12 bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-[#2a2a2a]"
        >
          No works found.
        </div>

        <div
          v-else
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
        >
          <div
            v-for="item in enhancedFilmography"
            :key="`${item.media_type}-${item.id}`"
            class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700 block group"
          >
            <div class="flex flex-col sm:grid sm:grid-cols-3 gap-4 h-full">
              <!-- Column 1: Media -->
              <NuxtLink
                :to="$localePath(`/${item.media_type === 'tv' ? 'show' : 'movie'}/${item.id}`)"
                class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div
                  class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 flex-shrink-0"
                >
                  <NuxtImg
                    format="webp" loading="lazy"
                    v-if="item.poster_path"
                    :src="resolveImageUrl(item.poster_path)"
                    :alt="item.title || item.name"
                    class="w-full h-full object-cover transition-transform duration-300"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-gray-400"
                  >
                    <ClapperboardIcon
                      class="w-6 h-6 sm:w-8 sm:h-8 opacity-20"
                    />
                  </div>
                </div>
                <div class="flex flex-col min-w-0 flex-1">
                  <span
                    class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5"
                    >{{
                      item.release_date
                        ? new Date(item.release_date).getFullYear()
                        : item.first_air_date
                          ? new Date(item.first_air_date).getFullYear()
                          : "N/A"
                    }}</span
                  >
                  <span
                    class="font-bold text-sm text-gray-900 dark:text-gray-100 leading-tight line-clamp-2"
                    :title="item.title || item.name"
                    >{{ item.title || item.name }}</span
                  >
                </div>
              </NuxtLink>

              <!-- Column 2: Voice Actor -->
              <NuxtLink
                v-if="item.voice_actors?.[0]"
                :to="$localePath(`/voice-actor/${item.voice_actors[0].id}`)"
                class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-3 sm:pt-0 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div
                  class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 flex-shrink-0"
                >
                  <NuxtImg
                    format="webp" loading="lazy"
                    v-if="item.voice_actors[0].profile_picture"
                    :src="item.voice_actors[0].profile_picture"
                    :alt="`${item.voice_actors[0].firstname} ${item.voice_actors[0].lastname}`"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold bg-gray-100 dark:bg-[#161616]"
                  >
                    <span>{{ item.voice_actors[0].firstname?.[0] }}{{ item.voice_actors[0].lastname?.[0] }}</span>
                  </div>
                </div>
                <div class="flex flex-col min-w-0 flex-1">
                  <span
                    class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5"
                    >Voiced by</span
                  >
                  <span
                    class="font-medium text-sm text-gray-700 dark:text-gray-300 leading-tight line-clamp-2"
                  >
                    {{ item.voice_actors[0].firstname }} {{ item.voice_actors[0].lastname }}
                  </span>
                </div>
              </NuxtLink>
              <div
                v-else
                class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-3 sm:pt-0"
              >
                <div
                  class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 flex-shrink-0"
                >
                  <div class="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold bg-gray-100 dark:bg-[#161616]">
                    <UserIcon class="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                  </div>
                </div>
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Voiced by</span>
                  <span class="font-medium text-sm text-gray-400 dark:text-gray-500 italic">Unknown</span>
                </div>
              </div>

              <!-- Column 3: Character -->
              <div
                class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-3 sm:pt-0"
              >
                <div
                  class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 relative flex-shrink-0"
                >
                  <!-- Note: character image from db is not fully integrated in item yet, falling back to a placeholder -->
                  <div
                    class="w-full h-full flex items-center justify-center text-gray-400"
                  >
                    <UserIcon class="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                  </div>
                </div>
                <div class="flex flex-col min-w-0 flex-1">
                  <span
                    class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5"
                    >As</span
                  >
                  <span
                    class="font-medium text-sm text-gray-700 dark:text-gray-300 leading-tight line-clamp-2"
                    >{{ item.character || "Unknown" }}</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      </template>
    </PersonDetailsLayout>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import PersonDetailsLayout from "../../components/layout/PersonDetailsLayout.vue";
import { onMounted, ref, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeftIcon, ClapperboardIcon, UserIcon } from "lucide-vue-next";
import { useActorData, fetchActorData } from "@app/shared-logic";
import ReportModal from "../../components/ReportModal.vue";

const isReportModalOpen = ref(false);

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const { locale, t } = useI18n();

const id = route.params.id as string;
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);

const { data: initialData } = await useAsyncData(`actor-${id}`, () =>
  fetchActorData(supabase, id)
);

const {
  actor,
  loading,
  searchQuery,
  filteredCredits,
  enhancedFilmography,
  availableLanguages,
  selectedLanguage,
  uniqueVoiceActorsByLanguage,
  filteredUniqueVoiceActorsByLanguage,
  loadActorData,
} = useActorData(supabase, initialData.value);

useHead({
  titleTemplate: null,
  title: computed(() => actor.value?.name ? actor.value.name : t('search.actor', 'Acteur')),
  meta: [
    {
      name: "description",
      content: computed(() => {
        const name = actor.value?.name || '';
        const desc = actor.value?.biography || (name ? t('seo.actorDescription', { name }) : t('seo.actorDescriptionFallback', 'Discover filmography and voice actors.'));
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      name: "keywords",
      content: computed(() => {
        if (!actor.value?.name) return t('home.meta.keywords');
        return t('seo.actorKeywords', { name: actor.value.name });
      })
    },
    {
      property: "og:title",
      content: computed(() => actor.value?.name ? actor.value.name : t('search.actor', 'Acteur'))
    },
    {
      property: "og:description",
      content: computed(() => {
        const name = actor.value?.name || '';
        const desc = actor.value?.biography || (name ? t('seo.actorDescription', { name }) : t('seo.actorDescriptionFallback', 'Discover filmography and voice actors.'));
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      property: "og:type",
      content: "profile"
    },
    {
      property: "og:url",
      content: computed(() => `https://dubbingbase.com/actor/${id}`)
    },
    {
      property: "og:image",
      content: computed(() => actor.value?.profile_path ? resolveImageUrl(actor.value.profile_path) : 'https://dubbingbase.com/default-og.jpg'),
    },
    {
      name: "twitter:card",
      content: "summary_large_image"
    },
    {
      name: "twitter:title",
      content: computed(() => actor.value?.name ? actor.value.name : t('search.actor', 'Acteur'))
    },
    {
      name: "twitter:description",
      content: computed(() => {
        const name = actor.value?.name || '';
        const desc = actor.value?.biography || (name ? t('seo.actorDescription', { name }) : t('seo.actorDescriptionFallback', 'Discover filmography and voice actors.'));
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      name: "twitter:image",
      content: computed(() => actor.value?.profile_path ? resolveImageUrl(actor.value.profile_path) : 'https://dubbingbase.com/default-og.jpg'),
    },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() => {
        const name = actor.value?.name || '';
        const json = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Person',
          url: `https://dubbingbase.com/actor/${id}`,
          name: name || t('search.actor', 'Acteur'),
          image: actor.value?.profile_path ? resolveImageUrl(actor.value.profile_path) : '',
          description: actor.value?.biography || (name ? t('seo.actorDescription', { name }) : t('seo.actorDescriptionFallback', 'Discover filmography and voice actors.')),
        });
        // HTML-escape the serialized JSON to prevent script-breaking sequences
        return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
      })
    }
  ]
});

function resolveImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w342${path}`;
}

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return "Inconnu";
  try {
    const displayNames = new Intl.DisplayNames([locale.value || "en"], {
      type: "language",
    });
    const name = displayNames.of(langCode);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : langCode;
  } catch (e) {
    return langCode;
  }
};
</script>
