<template>
  <div>
    <PersonSkeleton v-if="pending && !character" />
    <DetailsPage v-else-if="character">
      <header class="theme-surface-muted border-b theme-border-subtle theme-border">
        <div
          class="mx-auto flex max-w-7xl items-center gap-5 px-4 py-6 sm:px-6 md:gap-8 md:px-8 md:py-10"
        >
          <div
            class="h-28 w-20 shrink-0 overflow-hidden rounded-xl border theme-border-subtle theme-border theme-input shadow-sm sm:h-36 sm:w-24 md:h-44 md:w-32"
          >
            <NuxtImg
              v-if="character.image"
              :src="character.image"
              :alt="character.name"
              class="h-full w-full object-cover"
              format="webp"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center theme-text-muted text-4xl font-bold uppercase"
            >
              {{ character.name?.[0] }}
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="mb-2 text-xs font-semibold uppercase tracking-wider theme-text-muted">
              {{ $t("character.profileLabel") }}
            </div>
            <h1
              class="break-words text-3xl font-bold leading-tight theme-text sm:text-4xl md:text-5xl"
            >
              {{ character.name }}
            </h1>
            <div class="mt-4 flex flex-wrap items-center gap-2">
              <DetailsMetaChip variant="tag">
                {{ character.source === "tvdb" ? "TVDB" : $t("game.characters") }}
              </DetailsMetaChip>
              <DetailsMetaChip
                v-if="character.source === 'game' && character.igdbCharacterId"
                variant="tag"
                label="IGDB"
              >
                #{{ character.igdbCharacterId }}
              </DetailsMetaChip>
            </div>
          </div>
        </div>
      </header>

      <DetailsActionBar>
        <template #right>
          <DetailsBackLink
            v-if="character.source === 'game' && character.gameId"
            :to="localePath(`/game/${character.gameId}`)"
            :label="$t('character.gameAppearance')"
          />
          <DetailsExternalLink
            v-else-if="character.externalUrl"
            :href="character.externalUrl"
            label="TVDB"
          />
        </template>
      </DetailsActionBar>

      <div class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-10">
        <div v-if="character.description" class="mb-8 max-w-4xl">
          <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider theme-text-muted">
            {{ $t("character.about") }}
          </h2>
          <p class="whitespace-pre-wrap leading-relaxed theme-text-secondary">
            {{ character.description }}
          </p>
        </div>
        <section>
          <div class="mb-5 flex items-baseline justify-between gap-3">
            <h2 class="text-2xl font-bold theme-text">{{ $t("character.credits") }}</h2>
            <span class="text-sm theme-text-muted">{{ character.appearances.length }}</span>
          </div>
          <DetailsEmptyState v-if="character.appearances.length === 0">
            {{ $t("character.noCredits") }}
          </DetailsEmptyState>
          <ul v-else class="grid gap-4">
            <li
              v-for="appearance in visibleAppearances"
              :key="appearance.project.id"
              class="grid gap-4 rounded-xl border theme-border theme-input p-4 sm:p-5 md:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.2fr)] md:gap-6"
            >
              <div class="min-w-0">
                <NuxtLink
                  v-if="
                    appearance.project.content_type === 'movie' ||
                    appearance.project.content_type === 'tv'
                  "
                  :to="
                    localePath(
                      `/${appearance.project.content_type === 'tv' ? 'show' : 'movie'}/${appearance.project.content_id}`,
                    )
                  "
                  class="font-semibold theme-text hover:underline"
                >
                  {{
                    appearance.project.title ||
                    (appearance.project.content_type === "tv"
                      ? $t("character.showAppearance")
                      : $t("character.movieAppearance"))
                  }}
                  <span v-if="!appearance.project.title">#{{ appearance.project.content_id }}</span>
                </NuxtLink>
                <NuxtLink
                  v-else-if="appearance.project.content_type === 'video_game'"
                  :to="localePath(`/game/${appearance.project.content_id}`)"
                  class="font-semibold theme-text hover:underline"
                >
                  {{ $t("character.gameAppearance") }} #{{ appearance.project.content_id }}
                </NuxtLink>
              </div>
              <ul
                v-if="appearance.originalPerformers.length || appearance.credits.length"
                class="min-w-0 space-y-3 md:border-l md:theme-border-subtle md:pl-6"
              >
                <li
                  v-for="performer in appearance.originalPerformers"
                  :key="`original-${performer.id}`"
                >
                  <NuxtLink
                    :to="localePath(`/actor/${performer.id}`)"
                    class="text-sm theme-primary-text hover:underline"
                  >
                    <span class="theme-text-muted">{{ $t("character.originalPerformer") }}:</span>
                    {{ performer.name || $t("character.originalPerformer") }}
                  </NuxtLink>
                </li>
                <li
                  v-for="credit in appearance.credits"
                  :key="credit.id"
                  class="border-t theme-border-subtle pt-3"
                >
                  <div class="text-sm theme-text-muted">
                    {{ credit.language }}<span v-if="credit.studio"> · {{ credit.studio }}</span>
                  </div>
                  <NuxtLink
                    v-if="credit.voiceActor?.id"
                    :to="localePath(`/voice-actor/${credit.voiceActor.id}`)"
                    class="mt-1 inline-block text-sm theme-primary-text hover:underline"
                  >
                    {{ credit.voiceActor.firstname }} {{ credit.voiceActor.lastname }}
                  </NuxtLink>
                  <p v-if="credit.performance" class="mt-1 text-sm theme-text">
                    {{ credit.performance }}
                  </p>
                  <p v-if="credit.note" class="mt-1 text-sm theme-text-muted">
                    {{ credit.note }}
                  </p>
                </li>
              </ul>
            </li>
          </ul>
          <button
            v-if="visibleAppearances.length < character.appearances.length"
            type="button"
            class="mt-4 rounded-lg border theme-border px-4 py-2 text-sm theme-text hover:theme-border-strong"
            @click="visibleAppearanceCount += 12"
          >
            {{ $t("character.showMore") }}
          </button>
        </section>
      </div>
    </DetailsPage>
    <div v-else class="py-20 text-center theme-text-muted" role="status">
      <span v-if="error">{{ $t("character.loadError") }}</span>
      <span v-else>{{ $t("character.notFound") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import DetailsBackLink from "../../../components/layout/details/DetailsBackLink.vue";
import DetailsEmptyState from "../../../components/layout/details/DetailsEmptyState.vue";
import DetailsExternalLink from "../../../components/layout/details/DetailsExternalLink.vue";
import DetailsMetaChip from "../../../components/layout/details/DetailsMetaChip.vue";
import DetailsActionBar from "../../../components/layout/details/DetailsActionBar.vue";
import DetailsPage from "../../../components/layout/details/DetailsPage.vue";
import PersonSkeleton from "../../../components/PersonSkeleton.vue";

const route = useRoute();
const localePath = useLocalePath();
const source = computed(() => String(route.params.source));
const id = computed(() => String(route.params.id));
const visibleAppearanceCount = ref(12);
const {
  data: character,
  pending,
  error,
} = await useFetch(() => `/api/character/${source.value}/${id.value}`, {
  query: () =>
    source.value === "tvdb"
      ? { mediaType: route.query.mediaType, mediaId: route.query.mediaId }
      : undefined,
});
const visibleAppearances = computed(
  () => character.value?.appearances.slice(0, visibleAppearanceCount.value) ?? [],
);
</script>
