<template>
  <div
    class="theme-surface-overlay border theme-border-subtle theme-border rounded-2xl p-4 flex gap-4 items-center theme-hover-border transition-colors group shadow-md"
  >
    <NuxtLink
      :to="profilePath"
      class="relative w-14 h-14 rounded-full overflow-hidden theme-surface-muted shrink-0 border theme-border-subtle theme-border transition-colors flex items-center justify-center"
    >
      <NuxtImg
        v-if="item.profile_picture"
        :src="item.profile_picture"
        :alt="`${item.firstname} ${item.lastname}`"
        class="w-full h-full object-cover"
        format="webp"
        loading="lazy"
        decoding="async"
      />
      <span v-else class="text-sm font-bold theme-text-muted">
        {{ item.firstname?.[0] }}{{ item.lastname?.[0] }}
      </span>
    </NuxtLink>
    <div class="flex-1 min-w-0">
      <NuxtLink
        :to="profilePath"
        class="text-sm font-bold theme-text theme-hover-primary-text transition-colors truncate block"
      >
        {{ item.firstname }} {{ item.lastname }}
      </NuxtLink>
      <span class="text-xs theme-text-muted block truncate mt-0.5">
        {{ item.character_name || item.performance || fallbackRole }}
      </span>
      <span v-if="item.note" class="text-xs theme-text-muted block truncate mt-1">{{
        item.note
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MediaWorkCastCard } from "@app/shared-logic";

const props = defineProps<{ item: MediaWorkCastCard; fallbackRole: string }>();
const localePath = useLocalePath();
const profilePath = computed(() => localePath(`/voice-actor/${props.item.voice_actor_id}`));
</script>
