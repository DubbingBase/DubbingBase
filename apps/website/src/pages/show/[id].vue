<template>
  <div
    v-if="serie"
    class="bg-gray-50 dark:bg-[#1b1b1b] min-h-screen text-gray-900 dark:text-white"
  >
    <!-- Hero Section -->
    <div class="relative w-full h-[50vh] min-h-[400px]">
      <div class="absolute inset-0">
        <NuxtImg
          v-if="backdropUrl"
          :src="backdropUrl"
          class="w-full h-full object-cover"
          alt="Backdrop"
          format="webp"
        />
        <div
          class="absolute inset-0 bg-gradient-to-t from-gray-50 dark:from-[#1b1b1b] to-transparent"
        ></div>
        <div class="absolute inset-0 bg-black/10 dark:bg-black/40"></div>
      </div>

      <div
        class="absolute bottom-0 left-0 w-full p-8 flex flex-col md:flex-row gap-6 items-end"
      >
        <NuxtImg
          v-if="posterUrl"
          :src="posterUrl"
          class="w-32 md:w-48 rounded-lg shadow-xl"
          :alt="serie.name"
          format="webp"
        />
        <div class="pb-4 max-w-3xl">
          <h1 class="text-4xl md:text-5xl font-bold">{{ serie.name }}</h1>
          <div class="flex flex-wrap items-center gap-3 mt-4">
            <span class="text-gray-900 dark:text-gray-100 font-semibold text-base md:text-lg bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
              {{ new Date(serie.first_air_date).getFullYear() }}
              <template v-if="serie.number_of_seasons"> &bull; {{ serie.number_of_seasons }} Saisons</template>
            </span>
            <span v-if="serie.original_name !== serie.name" class="text-gray-800 dark:text-gray-300 font-medium text-sm md:text-base bg-white/40 dark:bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg">
              {{ serie.original_name }}
            </span>
            <span class="flex items-center gap-1.5 text-gray-900 dark:text-gray-100 font-bold text-sm md:text-base bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
              <StarIcon class="w-4 h-4 text-yellow-500 fill-current" />
              {{ serie.vote_average?.toFixed(1) }}
            </span>
            <div class="flex gap-2 ml-2">
              <a :href="`https://www.themoviedb.org/tv/${serie.id}`" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white/40 dark:bg-black/40 text-gray-800 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-black/60 transition-colors backdrop-blur-md uppercase tracking-wider">
                TMDB <ExternalLinkIcon class="w-3 h-3 opacity-70" />
              </a>
              <a v-if="tvdbId" :href="`https://thetvdb.com/search?query=${tvdbId}`" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white/40 dark:bg-black/40 text-gray-800 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-black/60 transition-colors backdrop-blur-md uppercase tracking-wider">
                TVDB <ExternalLinkIcon class="w-3 h-3 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Bar -->
    <div class="border-b border-gray-200 dark:border-[#2a2a2a] bg-white/95 dark:bg-[#161616]/95 backdrop-blur sticky top-0 z-10 shadow-sm">
      <div class="container mx-auto px-8 max-w-6xl py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <!-- Dubbing Projects Tabs -->
        <div v-if="dubbingProjects.length > 0" class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="project in dubbingProjects"
            :key="project.id"
            :to="{ query: { dub: project.id } }"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-[#2a2a2a]"
            :class="
              activeDubId === project.id
                ? 'bg-cyan-600 dark:bg-[#00E5FF] text-white dark:text-black border-cyan-600 dark:border-[#00E5FF]'
                : 'bg-white dark:bg-[#1d1d1d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
            "
          >
            {{
              $t("details.dubbing", {
                lang: getDisplayLanguage(project.language),
              })
            }}
          </NuxtLink>
        </div>
        <div v-else class="text-sm text-gray-500 font-medium">No dubbing projects available</div>
        
        <!-- Right side actions -->
        <div class="flex items-center flex-wrap gap-4">
          <template v-if="activeDubProject?.studio_data">
            <NuxtLink
              :to="$localePath(`/studio/${activeDubProject.studio_data.id}`)"
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2a2a2a] hover:border-cyan-500 transition-colors group bg-gray-50 dark:bg-[#1d1d1d]"
              title="Studio de doublage"
            >
              <div class="w-6 h-6 rounded flex items-center justify-center overflow-hidden shrink-0 bg-white dark:bg-[#2a2a2a]">
                <img v-if="activeDubProject.studio_data.logo_url" :src="activeDubProject.studio_data.logo_url" class="w-full h-full object-contain p-0.5" />
                <span v-else class="font-bold text-xs text-gray-400">{{ activeDubProject.studio_data.name.charAt(0) }}</span>
              </div>
              <span class="font-medium text-xs group-hover:text-cyan-500 transition-colors truncate max-w-[120px]">{{ activeDubProject.studio_data.name }}</span>
            </NuxtLink>
            <div class="h-6 w-px bg-gray-200 dark:bg-[#2a2a2a]"></div>
          </template>

          <NuxtLink v-if="isAdmin" :to="$localePath(`/show/${serie?.id || 'new'}/edit/${activeDubId || 'new'}`)" class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span class="hidden sm:inline">Éditer</span>
          </NuxtLink>
          
          <button
            @click="isReportModalOpen = true"
            class="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
            title="Signaler cette fiche"
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
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="container mx-auto p-8 max-w-6xl">
      <!-- Overview -->
      <div class="mb-12 max-w-4xl">
        <section>
          <h2 class="text-2xl font-bold mb-4">
            {{ $t("details.synopsis") }}
          </h2>
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
            {{ serie.overview || $t("details.noSynopsis") }}
          </p>
        </section>
      </div>

      <!-- Voice Cast -->
      <section>
        <div class="flex flex-col mb-6 gap-2">
          <div
            class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4"
          >
            <div>
              <h2 class="text-2xl font-bold">
                {{ $t("details.castAndCrew") }}
              </h2>
            </div>

            <div class="relative w-full sm:w-64">
              <SearchIcon
                class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              />
              <input
                v-model="searchQuery"
                type="search"
                :placeholder="$t('search.placeholder')"
                class="w-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-[#00E5FF] transition-all text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div
            v-for="actor in filteredCast"
            :key="actor.id"
            class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700"
          >
            <div class="flex flex-col sm:grid sm:grid-cols-3 gap-4">
              <!-- Original Actor -->
              <div
                class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start"
              >
                <NuxtLink
                  :to="$localePath(`/actor/${actor.id}`)"
                  class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0"
                >
                  <NuxtImg
                    format="webp"
                    v-if="actor.profile_path"
                    :src="actor.profile_path"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    alt="Actor"
                  />
                </NuxtLink>
                <div
                  class="flex flex-col min-w-0 flex-1 w-full overflow-hidden"
                >
                  <div
                    class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1"
                  >
                    <ClapperboardIcon class="w-3 h-3 flex-shrink-0" />
                    <span class="truncate block w-full">{{
                      $t("details.actor")
                    }}</span>
                  </div>
                  <NuxtLink
                    :to="$localePath(`/actor/${actor.id}`)"
                    class="font-bold text-sm text-gray-900 dark:text-white truncate hover:underline block w-full"
                    :title="actor.name"
                  >
                    {{ actor.name }}
                  </NuxtLink>
                </div>
              </div>

              <!-- Character -->
              <div
                class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start"
              >
                <div
                  class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0"
                >
                  <NuxtImg
                    format="webp"
                    v-if="actor.characterImage"
                    :src="actor.characterImage"
                    class="w-full h-full object-cover"
                    alt="Character"
                  />
                </div>
                <div
                  class="flex flex-col min-w-0 flex-1 w-full overflow-hidden"
                >
                  <div
                    class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1"
                  >
                    <UserIcon class="w-3 h-3 flex-shrink-0" />
                    <span class="truncate block w-full">{{
                      $t("details.character")
                    }}</span>
                  </div>
                  <div
                    class="font-bold text-sm text-gray-900 dark:text-white truncate block w-full"
                    :title="
                      actor.roles
                        ?.map((r: any) =>
                          r.episode_count
                            ? `${r.character} (${r.episode_count} eps)`
                            : r.character,
                        )
                        .join(', ') ||
                      actor.workCharacterName ||
                      ''
                    "
                  >
                    {{
                      actor.roles
                        ?.map((r: any) =>
                          r.episode_count
                            ? `${r.character} (${r.episode_count} eps)`
                            : r.character,
                        )
                        .join(", ") ||
                      actor.workCharacterName ||
                      $t("details.unknownCharacter")
                    }}
                  </div>
                </div>
              </div>

              <!-- Voice Actor -->
              <div
                class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0"
              >
                <template v-if="actor.voiceActor">
                  <NuxtLink
                    :to="$localePath(`/voice-actor/${actor.voiceActor.id}`)"
                    class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0"
                  >
                    <NuxtImg
                      format="webp"
                      v-if="actor.voiceActor.profile_picture"
                      :src="actor.voiceActor.profile_picture"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      alt="Voice Actor"
                    />
                    <div
                      v-else
                      class="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400"
                    >
                      {{ actor.voiceActor.firstname?.[0]
                      }}{{ actor.voiceActor.lastname?.[0] }}
                    </div>
                  </NuxtLink>
                  <div
                    class="flex flex-col min-w-0 flex-1 w-full overflow-hidden"
                  >
                    <div
                      class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1"
                    >
                      <MicIcon class="w-3 h-3 flex-shrink-0" />
                      <span class="truncate block w-full">{{
                        $t("details.voiceActor")
                      }}</span>
                    </div>
                    <NuxtLink
                      :to="$localePath(`/voice-actor/${actor.voiceActor.id}`)"
                      class="font-bold text-sm text-gray-900 dark:text-white truncate hover:underline block w-full"
                      :title="
                        actor.voiceActor.firstname +
                        ' ' +
                        actor.voiceActor.lastname
                      "
                    >
                      {{ actor.voiceActor.firstname }}
                      {{ actor.voiceActor.lastname }}
                    </NuxtLink>
                  </div>
                </template>
                <template v-else>
                  <div
                    class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-100 dark:bg-[#151515] sm:mb-3 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-800 flex-shrink-0"
                  >
                    <span
                      class="text-gray-400 dark:text-gray-600 text-xs text-center px-2"
                      >?</span
                    >
                  </div>
                  <div
                    class="flex flex-col min-w-0 flex-1 w-full overflow-hidden"
                  >
                    <div
                      class="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1"
                    >
                      <MicIcon class="w-3 h-3 opacity-50 flex-shrink-0" />
                      <span class="truncate block w-full">{{
                        $t("details.voiceActor")
                      }}</span>
                    </div>
                    <div
                      class="text-sm text-gray-400 italic truncate block w-full"
                    >
                      {{ $t("details.notSpecified") }}
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
  <div
    v-else-if="pending"
    class="min-h-screen bg-gray-50 dark:bg-[#1b1b1b] flex items-center justify-center"
  >
    <div
      class="w-12 h-12 border-4 border-cyan-600 dark:border-[#00E5FF] border-t-transparent rounded-full animate-spin"
    ></div>
  </div>

  <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

import { fetchShowData } from "@app/shared-logic";
import { computed, ref } from "vue";
import {
  ArrowLeftIcon,
  ClapperboardIcon,
  UserIcon,
  MicIcon,
  SearchIcon,
  ExternalLinkIcon,
  StarIcon
} from "lucide-vue-next";
import ReportModal from "../../components/ReportModal.vue";

const isReportModalOpen = ref(false);

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const showId = Array.isArray(route.params.id)
  ? route.params.id[0]
  : route.params.id;
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === 'admin' || user.value?.user_metadata?.role === 'admin';
});

const { data, pending } = await useAsyncData(`show-${showId}`, () =>
  fetchShowData(supabase, showId),
);

const { locale, t } = useI18n();

const serie = computed(() => data.value?.serie);
const dubbingProjects = computed(() => {
  const projects = [...(data.value?.dubbingProjects || [])];
  const currentLocale = locale.value.toLowerCase();
  return projects.sort((a, b) => {
    const aIsPref = a.language?.toLowerCase().startsWith(currentLocale) ? 1 : 0;
    const bIsPref = b.language?.toLowerCase().startsWith(currentLocale) ? 1 : 0;

    if (aIsPref !== bIsPref) {
      return bIsPref - aIsPref;
    }

    const aWorks = a.works?.length || 0;
    const bWorks = b.works?.length || 0;
    return bWorks - aWorks;
  });
});
const characterProfilePictures = computed(
  () => data.value?.characterProfilePictures || [],
);
const aggregateCredits = computed(
  () => data.value?.aggregateCredits || { cast: [] },
);
const tvdbId = computed(() => data.value?.tvdbId);

const backdropUrl = computed(() => {
  if (!serie.value?.backdrop_path) return null;
  return `https://image.tmdb.org/t/p/original${serie.value.backdrop_path}`;
});

const posterUrl = computed(() => {
  if (!serie.value?.poster_path) return null;
  return `https://image.tmdb.org/t/p/w500${serie.value.poster_path}`;
});

const activeDubId = computed(() => {
  if (route.query.dub) {
    return Number(route.query.dub);
  }
  return dubbingProjects.value[0]?.id || null;
});

const activeDubProject = computed(() => {
  return (
    dubbingProjects.value.find((p: any) => p.id === activeDubId.value) ||
    dubbingProjects.value[0]
  );
});

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return "Inconnu";
  try {
    const displayNames = new Intl.DisplayNames(["fr"], { type: "language" });
    const name = displayNames.of(langCode);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : langCode;
  } catch (e) {
    return langCode;
  }
};

// Format cast and attach voice actors
const formattedCast = computed(() => {
  if (!aggregateCredits.value?.cast) return [];

  // Get works (dubbing links) for the currently active dubbing project
  const works = activeDubProject.value?.works || [];

  return aggregateCredits.value.cast.map((actor: any) => {
    let profilePath = actor.profile_path;
    if (profilePath && profilePath.startsWith("/")) {
      profilePath = `https://image.tmdb.org/t/p/w185${profilePath}`;
    }

    // Find the voice actor work for this physical actor
    const work = works.find((w: any) => w.actor_id === actor.id);
    const voiceActor = work?.voice_actor;
    // Fallback character name from DB when TMDB returns no roles
    const workCharacterName = work?.character_name || null;

    // Find character picture matching the character name
    let characterImage = null;
    const characterName =
      actor.roles?.map((r: any) => r.character).join(", ") || workCharacterName;
    if (characterName) {
      // Try to match any of the roles, then fallback to workCharacterName
      const namesToTry = [
        ...(actor.roles || []).map((r: any) => r.character).filter(Boolean),
        ...(workCharacterName ? [workCharacterName] : []),
      ];
      for (const name of namesToTry) {
        const match = characterProfilePictures.value.find(
          (c: any) => c.name && c.name.toLowerCase() === name.toLowerCase(),
        );
        if (match && match.image) {
          characterImage = match.image;
          break;
        }
      }
    }

    return {
      ...actor,
      profile_path: profilePath,
      voiceActor: voiceActor || null,
      characterImage,
      workCharacterName,
    };
  });
});

const searchQuery = ref("");

const filteredCast = computed(() => {
  if (!searchQuery.value) return formattedCast.value;
  const query = searchQuery.value.toLowerCase();
  return formattedCast.value.filter((actor: any) => {
    const actorName = actor.name?.toLowerCase() || "";
    const characterName = (
      actor.roles?.map((r: any) => r.character).join(", ") || ""
    ).toLowerCase();
    const vaName = actor.voiceActor
      ? `${actor.voiceActor.firstname || ""} ${actor.voiceActor.lastname || ""}`.toLowerCase()
      : "";
    const vaPerformance = actor.voiceActor?.performance?.toLowerCase() || "";
    return (
      actorName.includes(query) ||
      characterName.includes(query) ||
      vaName.includes(query) ||
      vaPerformance.includes(query)
    );
  });
});

useHead({
  titleTemplate: null,
  title: computed(() => {
    const year = serie.value?.first_air_date
      ? ` (${new Date(serie.value.first_air_date).getFullYear()})`
      : "";
    let base = serie.value ? `${serie.value.name}${year}` : "Série";
    if (activeDubProject.value) {
      base += ` - Doublage ${getDisplayLanguage(activeDubProject.value.language)}`;
    }
    return base;
  }),
  meta: [
    {
      name: "description",
      content: computed(() => {
        let desc =
          serie.value?.overview ||
          `Découvrez le casting et les voix de la série ${serie.value?.name}.`;
        if (activeDubProject.value) {
          desc =
            `Découvrez le casting complet des voix pour le doublage ${getDisplayLanguage(activeDubProject.value.language)} de la série ${serie.value?.name}. ` +
            desc;
        }
        return desc;
      }),
    },
    {
      name: "keywords",
      content: computed(() => {
        const title = serie.value?.name || "";
        if (!title) return t("home.meta.keywords");
        return t("seo.showKeywords", { title });
      }),
    },
    {
      property: "og:image",
      content: computed(() => backdropUrl.value || posterUrl.value || ""),
    },
  ],
  link: computed(() => {
    const links = [
      {
        rel: "canonical",
        href: (() => {
          const baseUrl = "https://dubbingbase.com/show/" + showId;
          return activeDubId.value
            ? `${baseUrl}?dub=${activeDubId.value}`
            : baseUrl;
        })(),
      },
    ];
    if (backdropUrl.value) {
      links.push({
        rel: "preload",
        as: "image",
        href: backdropUrl.value,
      } as any);
    }
    return links;
  }),
  script: [
    {
      type: "application/ld+json",
      innerHTML: computed(() =>
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TVSeries",
          url: `https://dubbingbase.com/show/${showId}`,
          name: serie.value?.name || "Série",
          image: posterUrl.value || backdropUrl.value || "",
          description:
            serie.value?.overview ||
            `Découvrez le casting et les voix de la série ${serie.value?.name}.`,
          startDate: serie.value?.first_air_date || undefined,
          actor: formattedCast.value.map((actor: any) => ({
            "@type": "PerformanceRole",
            actor: {
              "@type": "Person",
              name: actor.name,
            },
            characterName: actor.character,
          })),
        }),
      ),
    },
  ],
});
</script>
