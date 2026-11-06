<template>
  <button
    type="button"
    class="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition theme-surface theme-border-subtle theme-focus theme-hover-surface-muted theme-hover-border-strong sm:gap-4 sm:p-4"
    :class="selected ? 'theme-selected theme-border-strong' : ''"
    :aria-label="accessibleLabel"
    :disabled="disabled"
    @click="$emit('select')"
  >
    <div
      class="relative flex h-[68px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-xl theme-surface-muted sm:h-[76px] sm:w-[56px]"
    >
      <NuxtImg
        v-if="imagePath"
        :src="imagePath"
        :alt="displayName"
        width="48"
        height="64"
        loading="lazy"
        decoding="async"
        class="h-full w-full object-cover"
      />
      <Gamepad2Icon
        v-else-if="result.media_type === 'video_game'"
        class="h-6 w-6 theme-text-muted"
      />
      <ImageIcon v-else class="h-6 w-6 theme-text-muted" />
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span
          class="min-w-0 flex-1 truncate text-sm font-semibold tracking-[0.01em] theme-text transition group-hover:text-[var(--app-color-primary)] sm:text-base"
        >
          {{ displayName }}
        </span>
        <span
          :title="mediaTypeLabel"
          aria-hidden="true"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border theme-border-subtle theme-border-strong theme-surface-muted theme-text-secondary"
        >
          <component :is="mediaTypeIcon" class="h-4 w-4" :class="mediaTypeIconColor" />
        </span>
      </div>

      <div class="mt-1.5 flex min-w-0 items-center gap-2 truncate text-xs theme-text-muted">
        <span v-if="releaseYear">
          {{ releaseYear }}
        </span>
        <span v-if="releaseYear && (relatedCompany || result.overview)">&bull;</span>
        <span v-if="relatedCompany" class="truncate">{{ relatedCompany }}</span>
        <span v-if="relatedCompany && result.overview">&bull;</span>
        <span v-if="result.overview" class="truncate">
          {{ result.overview }}
        </span>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Component } from "vue";
import {
  BookOpenIcon,
  FilmIcon,
  Gamepad2Icon,
  ImageIcon,
  MegaphoneIcon,
  MicIcon,
  RadioIcon,
  SmileIcon,
  TvIcon,
  UserIcon,
} from "lucide-vue-next";
import type { SearchResult } from "@app/shared-logic";

const props = defineProps<{
  result: SearchResult;
  mediaTypeLabel: string;
  selected: boolean;
  disabled?: boolean;
}>();

const mediaTypeIcons: Record<SearchResult["media_type"], Component> = {
  movie: FilmIcon,
  tv: TvIcon,
  person: UserIcon,
  voice_actor: MicIcon,
  video_game: Gamepad2Icon,
  audiobook: BookOpenIcon,
  podcast: RadioIcon,
  advertisement: MegaphoneIcon,
  toy: SmileIcon,
};

const mediaTypeIconColors: Record<SearchResult["media_type"], string> = {
  movie: "text-[var(--app-color-search-movie)]",
  tv: "text-[var(--app-color-search-tv)]",
  person: "text-[var(--app-color-search-person)]",
  voice_actor: "text-[var(--app-color-search-voice-actor)]",
  video_game: "text-[var(--app-color-search-video-game)]",
  audiobook: "text-[var(--app-color-search-audiobook)]",
  podcast: "text-[var(--app-color-search-podcast)]",
  advertisement: "text-[var(--app-color-search-advertisement)]",
  toy: "text-[var(--app-color-search-toy)]",
};

defineEmits<{
  select: [];
}>();

const displayName = computed(
  () =>
    props.result.title ||
    props.result.name ||
    props.result.voice_actor_name ||
    [props.result.firstname, props.result.lastname].filter(Boolean).join(" ") ||
    props.result.author_name ||
    props.result.brand ||
    props.result.product_line ||
    String(props.result.id),
);
const mediaTypeIcon = computed(() => mediaTypeIcons[props.result.media_type]);
const mediaTypeIconColor = computed(() => mediaTypeIconColors[props.result.media_type]);

const imagePath = computed(
  () => props.result.poster_path || props.result.profile_path || props.result.cover?.url,
);
const releaseYear = computed(() => {
  const date = props.result.release_date || props.result.first_air_date;
  if (date) return date.substring(0, 4);
  return props.result.first_release_date
    ? new Date(props.result.first_release_date * 1000).getFullYear().toString()
    : undefined;
});
const relatedCompany = computed(
  () => props.result.studio_names?.join(", ") || props.result.manufacturer || props.result.brand,
);
const accessibleLabel = computed(() =>
  [displayName.value, props.mediaTypeLabel, releaseYear.value, relatedCompany.value]
    .filter(Boolean)
    .join(", "),
);
</script>
