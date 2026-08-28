<template>
  <div>
    <MediaSkeleton v-if="pending && !game" />
    <MediaDetailsLayout
      v-else-if="game"
      :title="game.name"
      :backdrop-url="game.artworks?.[0]?.url || game.screenshots?.[0]?.url || null"
      :poster-url="coverUrl"
      :loading="pending"
    >
      <template #metadata>
        <span class="text-gray-900 dark:text-gray-100 font-semibold text-base md:text-lg bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
          {{ formatReleaseYear(game.first_release_date) }}
        </span>
        <span v-if="game.rating" class="flex items-center gap-1.5 text-gray-900 dark:text-gray-100 font-bold text-sm md:text-base bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
          <StarIcon class="w-4 h-4 text-yellow-500 fill-current" />
          {{ (game.rating / 10).toFixed(1) }}
        </span>
        <div class="flex gap-2 ml-2">
          <a :href="`https://www.igdb.com/games/${game.slug}`" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white/40 dark:bg-black/40 text-gray-800 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-black/60 transition-colors backdrop-blur-md uppercase tracking-wider">
            IGDB <ExternalLinkIcon class="w-3 h-3 opacity-70" />
          </a>
        </div>
      </template>

      <template #actions-left>
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
      </template>

      <template #actions-right>
        <template v-if="activeDubProject?.studio_data">
          <NuxtLink
            :to="localePath(`/studio/${activeDubProject.studio_data.id}`)"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2a2a2a] hover:border-cyan-500 transition-colors group bg-gray-50 dark:bg-[#1d1d1d]"
            title="Studio de doublage"
          >
            <div class="w-6 h-6 rounded flex items-center justify-center overflow-hidden shrink-0 bg-white dark:bg-[#2a2a2a]">
              <img v-if="activeDubProject.studio_data.logo_url" :src="activeDubProject.studio_data.logo_url" class="w-full h-full object-contain p-0.5" />
              <span v-else class="font-bold text-xs text-gray-400">{{ activeDubProject.studio_data.name?.charAt(0) || '' }}</span>
            </div>
            <span class="font-medium text-xs group-hover:text-cyan-500 transition-colors truncate max-w-[120px]">{{ activeDubProject.studio_data.name }}</span>
          </NuxtLink>
          <div class="h-6 w-px bg-gray-200 dark:bg-[#2a2a2a]"></div>
        </template>

        <ClientOnly>
          <button v-if="isAdmin" @click="triggerPrepareGame" :disabled="isPreparing" class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium">
            <Loader2Icon v-if="isPreparing" class="w-4 h-4 animate-spin" />
            <Gamepad2Icon v-else class="w-4 h-4" />
            <span class="hidden sm:inline">{{ $t('game.prepareCredits', 'Extraire les crédits') }}</span>
          </button>

          <NuxtLink v-if="isAdmin" :to="localePath(`/game/${game?.id || 'new'}/edit/${activeDubId || 'new'}`)" class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span class="hidden sm:inline">Éditer</span>
          </NuxtLink>
        </ClientOnly>
        
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
      </template>

      <template #content>
        <!-- Overview -->
        <div class="mb-12 max-w-4xl">
        <section>
          <h2 class="text-2xl font-bold mb-4">{{ $t('details.synopsis', 'Synopsis') }}</h2>
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed text-lg mb-8">
            {{ game.summary || $t('details.noSynopsis', 'Aucun synopsis disponible.') }}
          </p>
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white dark:bg-[#1d1d1d] p-6 rounded-xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm dark:shadow-none">
            <div>
              <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{{ $t('game.developer', 'Développeur') }}</h3>
              <p class="font-medium text-sm">{{ getDevelopers(game) || '-' }}</p>
            </div>
            <div>
              <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{{ $t('game.publisher', 'Éditeur') }}</h3>
              <p class="font-medium text-sm">{{ getPublishers(game) || '-' }}</p>
            </div>
            <div class="col-span-2 md:col-span-1">
              <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{{ $t('game.genres', 'Genres') }}</h3>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="genre in game.genres" :key="genre.id" class="px-2 py-0.5 bg-gray-100 dark:bg-[#2a2a2a] text-xs font-medium rounded-md text-gray-700 dark:text-gray-300">
                  {{ genre.name }}
                </span>
              </div>
            </div>
            <div class="col-span-2 md:col-span-1">
              <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{{ $t('game.platforms', 'Plateformes') }}</h3>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="platform in game.platforms" :key="platform.id" class="px-2 py-0.5 bg-gray-100 dark:bg-[#2a2a2a] text-xs font-medium rounded-md text-gray-700 dark:text-gray-300">
                  {{ platform.name }}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Voice Cast -->
      <section>
        <div class="flex flex-col mb-6 gap-2">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h2 class="text-2xl font-bold">{{ $t('details.castAndCrew', 'Casting') }}</h2>
              <div class="text-gray-500 dark:text-gray-400 text-sm mt-1">{{ filteredCharacters.length }} / {{ formattedCharacters.length }} rôles</div>
            </div>
            
            <div class="relative w-full sm:w-64">
              <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="searchQuery"
                type="search"
                :placeholder="$t('search.placeholder', 'Rechercher...')"
                class="w-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-[#00E5FF] transition-all text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          <div
            v-for="char in filteredCharacters"
            :key="char.id"
            class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700"
          >
            <!-- 2 Column Layout for Games (Character -> Voice Actor) -->
            <div class="flex flex-col sm:grid sm:grid-cols-2 gap-4">
              
              <!-- Character -->
              <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start">
                <div class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0">
                  <NuxtImg format="webp" v-if="char.mug_shot?.url" :src="char.mug_shot.url" class="w-full h-full object-cover" alt="Character" />
                  <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                    <UserIcon class="w-8 h-8 opacity-50" />
                  </div>
                </div>
                <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                  <div class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                    <UserIcon class="w-3 h-3 flex-shrink-0" />
                    <span class="truncate block w-full">{{ $t('details.character', 'Personnage') }}</span>
                  </div>
                  <div class="font-bold text-sm text-gray-900 dark:text-white truncate block w-full" :title="char.name">
                    {{ char.name }}
                  </div>
                </div>
              </div>

              <!-- Voice Actor -->
              <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
                <template v-if="char.voiceActor">
                  <NuxtLink :to="localePath(`/voice-actor/${char.voiceActor.id}`)" class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0">
                    <NuxtImg format="webp" v-if="char.voiceActor.profile_picture" :src="char.voiceActor.profile_picture" class="w-full h-full object-cover transition-transform duration-300" alt="Voice Actor" />
                    <div v-else class="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400 uppercase bg-gray-300 dark:bg-gray-800">
                      {{ char.voiceActor.firstname?.[0] }}{{ char.voiceActor.lastname?.[0] }}
                    </div>
                  </NuxtLink>
                  <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                    <div class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                      <MicIcon class="w-3 h-3 flex-shrink-0" />
                      <span class="truncate block w-full">{{ $t('details.voiceActor', 'Voice Actor') }}</span>
                    </div>
                    <NuxtLink :to="localePath(`/voice-actor/${char.voiceActor.id}`)" class="font-bold text-sm text-gray-900 dark:text-white truncate hover:underline block w-full" :title="char.voiceActor.firstname + ' ' + char.voiceActor.lastname">
                      {{ char.voiceActor.firstname }} {{ char.voiceActor.lastname }}
                    </NuxtLink>
                    <div v-if="char.voiceActor.performance" class="text-xs text-cyan-600 dark:text-cyan-400 truncate mt-1">
                      {{ char.voiceActor.performance }}
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0">
                    <div class="w-full h-full flex items-center justify-center text-gray-400">
                      <UserIcon class="w-8 h-8 opacity-50" />
                    </div>
                  </div>
                  <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                    <div class="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">
                      <MicIcon class="w-3 h-3 opacity-50 flex-shrink-0" />
                      <span class="truncate block w-full">{{ $t('details.voiceActor', 'Voice Actor') }}</span>
                    </div>
                    <div class="text-sm text-gray-400 italic truncate block w-full">{{ $t('details.notSpecified', 'Non spécifié') }}</div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>
      </template>
    </MediaDetailsLayout>

    <div v-else-if="!pending" class="text-center py-20 text-gray-500 min-h-screen">
      {{ $t('details.notFound', 'Jeu vidéo introuvable.') }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import MediaSkeleton from "../../components/MediaSkeleton.vue";
import MediaDetailsLayout from "../../components/layout/MediaDetailsLayout.vue";
import { useRoute, useRouter } from 'vue-router';
import { fetchGameData } from '@app/shared-logic';
import type { IgdbGame, IgdbCharacter } from '@app/shared-logic';
import { computed, ref } from 'vue';
import { ArrowLeftIcon, UserIcon, MicIcon, SearchIcon, Gamepad2Icon, Loader2Icon, StarIcon, ExternalLinkIcon } from 'lucide-vue-next';
import ReportModal from '../../components/ReportModal.vue';

const isReportModalOpen = ref(false);

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const gameId = (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id) || '';
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === 'admin' || user.value?.user_metadata?.role === 'admin';
});

const isPreparing = ref(false);

const { locale, t } = useI18n();
const localePath = useLocalePath();

const cacheKey = `game-${gameId}-${locale.value}`;
const { data, pending, refresh } = useAsyncData(cacheKey, async () => {
  const nuxtApp = useNuxtApp();
  // We only have cached data on the client side after hydration
  const cachedData = nuxtApp.payload.data[cacheKey];

  const newData = await fetchGameData(gameId, locale.value);

  // If IGDB fetch fails on the edge function (e.g., timeout)
  // but we already have valid data from SSR, we preserve the IGDB data
  // while still accepting the fresh database data (votes, dubbing projects).
  if (
    newData && 
    newData.game?.name === "Information indisponible (Timeout)" && 
    cachedData?.game &&
    cachedData.game.name !== "Information indisponible (Timeout)"
  ) {
    return {
      ...newData,
      game: cachedData.game,
      characters: cachedData.characters,
    };
  }

  return newData;
});

const game = computed(() => data.value?.game);
const characters = computed(() => data.value?.characters || []);
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

const coverUrl = computed(() => {
  if (!game.value?.cover?.url) return null;
  return game.value.cover.url;
});

const activeDubId = computed(() => {
  if (route.query.dub) {
    return Number(route.query.dub);
  }
  return dubbingProjects.value[0]?.id || null;
});

const activeDubProject = computed(() => {
  return dubbingProjects.value.find((p: any) => p.id === activeDubId.value) || dubbingProjects.value[0];
});

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return 'Unknown';
  try {
    const displayNames = new Intl.DisplayNames([locale.value || 'en'], { type: 'language' });
    const name = displayNames.of(langCode);
    return (typeof name === 'string' && name.length > 0)
      ? name.charAt(0).toUpperCase() + name.slice(1)
      : langCode;
  } catch (e) {
    return langCode;
  }
};

const getDevelopers = (g: IgdbGame) => g.involved_companies?.filter(c => c.developer).map(c => c.company.name).join(", ");
const getPublishers = (g: IgdbGame) => g.involved_companies?.filter(c => c.publisher).map(c => c.company.name).join(", ");
const formatReleaseYear = (ts?: number) => ts ? new Date(ts * 1000).getFullYear().toString() : "";

// Map IGDB character IDs to Actor IDs (what we use in the work table)
function igdbCharacterId(charId: number): number {
  return 9_000_000_000 + charId;
}

// Format characters and attach voice actors
const formattedCharacters = computed(() => {
  // Get works (dubbing links) for the currently active dubbing project
  const works = activeDubProject.value?.works || [];
  const igdbChars = characters.value || [];
  const matchedWorkIds = new Set();

  const mappedIgdbChars = igdbChars.map((char: IgdbCharacter) => {
    // Character ID was mapped in prepare_game using igdbCharacterId
    const mappedActorId = igdbCharacterId(char.id);
    
    // Fallback ID mapping used by LLM for unresolved names
    const hashId = Math.abs(
      char.name.split("").reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) | 0, 0),
    ) + 8_000_000_000;

    // Find the voice actor work for this character.
    // Check actor_id (set by prepare_game) and character_id (set by manual entry in the edit form).
    const work = works.find((w: any) =>
      w.actor_id === mappedActorId ||
      w.actor_id === hashId ||
      w.character_id === char.id ||
      w.character_id === mappedActorId
    );
    
    if (work) {
      matchedWorkIds.add(work.id);
    }
    
    return {
      ...char,
      voiceActor: work ? { ...work.voice_actor, performance: work.performance } : null,
    };
  });

  // Find all works that were NOT matched to an IGDB character
  const unmatchedWorks = works.filter((w: any) => !matchedWorkIds.has(w.id));
  
  // Create mock characters for unmatched works.
  // Try to resolve the name from the IGDB character list (by character_id) before
  // falling back to work.character_name, then 'Inconnu'.
  const mockChars = unmatchedWorks.map((work: any) => {
    let resolvedName = work.character_name || null;
    if (!resolvedName && work.character_id) {
      const igdbChar = igdbChars.find((c: IgdbCharacter) => igdbCharacterId(c.id) === work.character_id || c.id === work.character_id);
      if (igdbChar) resolvedName = igdbChar.name;
    }
    return {
      id: `mock-${work.id}`,
      name: resolvedName || 'Inconnu',
      mug_shot: null,
      voiceActor: { ...work.voice_actor, performance: work.performance }
    };
  });

  const allCharacters = [...mappedIgdbChars, ...mockChars];

  return allCharacters.sort((a, b) => {
    // 1. Characters with a voice actor assigned go first
    const aHasVa = a.voiceActor ? 1 : 0;
    const bHasVa = b.voiceActor ? 1 : 0;
    if (aHasVa !== bHasVa) return bHasVa - aHasVa;

    // 2. Characters with a picture go next
    const aHasMug = a.mug_shot ? 1 : 0;
    const bHasMug = b.mug_shot ? 1 : 0;
    if (aHasMug !== bHasMug) return bHasMug - aHasMug;

    // 3. Sort alphabetically by name as a fallback
    return (a.name || '').localeCompare(b.name || '');
  });
});

const searchQuery = ref('');

const filteredCharacters = computed(() => {
  if (!searchQuery.value) return formattedCharacters.value;
  const query = searchQuery.value.toLowerCase();
  return formattedCharacters.value.filter((char: any) => {
    const characterName = char.name?.toLowerCase() || '';
    const vaName = char.voiceActor ? `${char.voiceActor.firstname || ''} ${char.voiceActor.lastname || ''}`.toLowerCase() : '';
    const vaPerformance = char.voiceActor?.performance?.toLowerCase() || '';
    return characterName.includes(query) || vaName.includes(query) || vaPerformance.includes(query);
  });
});

async function triggerPrepareGame() {
  if (!isAdmin.value) return;
  isPreparing.value = true;
  try {
    await $fetch('/api/prepare_game', { method: 'POST', body: { igdbId: Number(gameId) } });
    await refresh();
  } catch (err) {
    console.error("prepare_game failed:", err);
  } finally {
    isPreparing.value = false;
  }
}

useHead({
  titleTemplate: null,
  title: computed(() => {
    const year = game.value?.first_release_date ? ` (${formatReleaseYear(game.value.first_release_date)})` : '';
    let base = game.value ? `${game.value.name}${year}` : 'Jeu Vidéo';
    if (activeDubProject.value) {
      base += ` - Doublage ${getDisplayLanguage(activeDubProject.value.language)}`;
    }
    return base;
  }),
  meta: [
    {
      name: 'description',
      content: computed(() => {
        let desc = game.value?.summary || `Découvrez les voix françaises et le casting du jeu vidéo ${game.value?.name}.`;
        if (activeDubProject.value) {
          desc = `Découvrez le casting complet des voix pour le doublage ${getDisplayLanguage(activeDubProject.value.language)} du jeu ${game.value?.name}. ` + desc;
        }
        return desc;
      })
    },
    {
      property: 'og:image',
      content: computed(() => coverUrl.value || '')
    }
  ]
});
</script>
