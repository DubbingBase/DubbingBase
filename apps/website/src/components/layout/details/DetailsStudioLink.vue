<template>
  <DetailsActionButton
    :to="localePath(`/studio/${studio.id}`)"
    hover="primary"
    :title="$t('details.dubbingStudio')"
  >
    <div
      class="w-6 h-6 rounded flex items-center justify-center overflow-hidden shrink-0 theme-surface-muted"
    >
      <img
        v-if="studio.logo_url"
        :src="studio.logo_url"
        :alt="studio.name ?? ''"
        class="w-full h-full object-contain p-0.5"
      />
      <span v-else class="font-bold text-xs theme-text-muted">{{
        studio.name?.charAt(0) || ""
      }}</span>
    </div>
    <span
      class="font-medium text-xs theme-hover-primary-text transition-colors truncate max-w-[120px]"
      >{{ studio.name }}</span
    >
  </DetailsActionButton>
  <div class="h-6 w-px theme-surface-muted"></div>
</template>

<script setup lang="ts">
import DetailsActionButton from "./DetailsActionButton.vue";
const localePath = useLocalePath();
defineProps<{
  studio: { id: number; name?: string | null; logo_url?: string | null };
}>();
</script>
