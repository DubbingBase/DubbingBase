<template>
  <div
    class="flex gap-2 overflow-x-auto no-scrollbar"
    role="group"
    :aria-label="t('common.filter')"
  >
    <button
      v-for="filter in filters"
      :key="filter.value"
      type="button"
      class="inline-flex h-9 shrink-0 items-center justify-center rounded-full px-4 text-sm font-medium leading-none transition theme-focus cursor-pointer"
      :class="
        modelValue === filter.value
          ? 'theme-selected'
          : 'theme-surface-raised theme-surface-muted theme-text-secondary theme-hover-surface-muted'
      "
      :aria-pressed="modelValue === filter.value"
      @click="$emit('update:modelValue', filter.value)"
    >
      {{ filter.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { SearchFilter } from "../utils/search-routes";

defineProps<{
  modelValue: SearchFilter;
}>();

defineEmits<{
  "update:modelValue": [value: SearchFilter];
}>();

const { t } = useI18n();

const filters = computed<Array<{ label: string; value: SearchFilter }>>(() => [
  { label: t("search.all"), value: "all" },
  { label: t("search.movie"), value: "movie" },
  { label: t("search.tv"), value: "tv" },
  { label: t("search.actor"), value: "person" },
  { label: t("search.voiceActor"), value: "voice_actor" },
  { label: t("search.videoGame"), value: "video_game" },
  { label: t("search.audiobook"), value: "audiobook" },
  { label: t("search.podcast"), value: "podcast" },
  { label: t("search.advertisement"), value: "advertisement" },
  { label: t("search.toy"), value: "toy" },
]);
</script>
