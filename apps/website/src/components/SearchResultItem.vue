<template>
  <button
    type="button"
    class="group flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition theme-hover-surface-muted"
    :class="selected ? 'theme-surface-raised theme-surface-muted' : ''"
    :aria-label="accessibleLabel"
    :disabled="disabled"
    @click="$emit('select')"
  >
    <div
      class="relative flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg theme-surface-muted shadow-sm"
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
          class="truncate font-bold theme-text transition group-hover:text-[var(--app-color-primary)]"
        >
          {{ displayName }}
        </span>
        <span
          class="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium theme-border-subtle theme-border-strong theme-surface-muted theme-text-muted"
        >
          {{ mediaTypeLabel }}
        </span>
      </div>

      <div class="mt-1 flex items-center gap-2 truncate text-xs theme-text-muted">
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
import { Gamepad2Icon, ImageIcon } from "lucide-vue-next";
import type { SearchResult } from "@app/shared-logic";

const props = defineProps<{
  result: SearchResult;
  mediaTypeLabel: string;
  selected: boolean;
  disabled?: boolean;
}>();

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
