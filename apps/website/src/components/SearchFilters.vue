<template>
  <div class="relative pr-5 sm:pr-0">
    <div
      class="flex gap-1.5 overflow-x-auto no-scrollbar rounded-xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)] sm:gap-2"
      role="group"
      tabindex="0"
      :aria-label="t('common.filter')"
    >
      <button
        v-for="filter in filters"
        :key="filter.value"
        type="button"
        class="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 text-xs font-semibold leading-none transition theme-focus cursor-pointer sm:gap-2 sm:px-4 sm:text-sm"
        :class="
          modelValue === filter.value
            ? 'theme-selected'
            : 'theme-surface-raised theme-text-secondary theme-hover-surface-muted theme-hover-border-strong'
        "
        :aria-pressed="modelValue === filter.value"
        @pointerdown="keepTouchFocus"
        @click="$emit('update:modelValue', filter.value)"
      >
        <component :is="filter.icon" class="h-4 w-4" aria-hidden="true" />
        {{ filter.label }}
      </button>
    </div>
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 right-0 flex w-5 items-center justify-center bg-[var(--app-color-background)] sm:hidden"
    >
      <ChevronRightIcon class="h-3.5 w-3.5 theme-text-muted" />
    </span>
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-5 bg-gradient-to-l from-[var(--app-color-background)] to-transparent sm:block"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";
import { useI18n } from "vue-i18n";
import {
  BookOpen as BookOpenIcon,
  ChevronRight as ChevronRightIcon,
  Film as FilmIcon,
  Gamepad2 as Gamepad2Icon,
  Layers as LayersIcon,
  Megaphone as MegaphoneIcon,
  Mic as MicIcon,
  Radio as RadioIcon,
  Smile as SmileIcon,
  Tv as TvIcon,
  User as UserIcon,
} from "lucide-vue-next";
import type { SearchFilter } from "../utils/search-routes";

defineProps<{
  modelValue: SearchFilter;
}>();

defineEmits<{
  "update:modelValue": [value: SearchFilter];
}>();

const { t } = useI18n();

const keepTouchFocus = (event: PointerEvent): void => {
  if (event.pointerType === "touch") event.preventDefault();
};

const filters = computed<Array<{ label: string; value: SearchFilter; icon: Component }>>(() => [
  { label: t("search.all"), value: "all", icon: LayersIcon },
  { label: t("search.movie"), value: "movie", icon: FilmIcon },
  { label: t("search.tv"), value: "tv", icon: TvIcon },
  { label: t("search.actor"), value: "person", icon: UserIcon },
  { label: t("search.voiceActor"), value: "voice_actor", icon: MicIcon },
  { label: t("search.videoGame"), value: "video_game", icon: Gamepad2Icon },
  { label: t("search.audiobook"), value: "audiobook", icon: BookOpenIcon },
  { label: t("search.podcast"), value: "podcast", icon: RadioIcon },
  { label: t("search.advertisement"), value: "advertisement", icon: MegaphoneIcon },
  { label: t("search.toy"), value: "toy", icon: SmileIcon },
]);
</script>
