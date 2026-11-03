<template>
  <span
    class="relative inline-flex shrink-0 items-center justify-center overflow-hidden border theme-border theme-surface-muted text-xs font-semibold theme-text-secondary"
    :class="large ? 'h-20 w-16 rounded-xl text-base' : 'h-10 w-10 rounded-full'"
    :title="name || undefined"
  >
    <NuxtImg
      v-if="src && !failed"
      :src="src"
      alt=""
      :width="large ? 64 : 40"
      :height="large ? 80 : 40"
      format="webp"
      loading="lazy"
      decoding="async"
      class="h-full w-full object-cover"
      @error="failed = true"
    />
    <span v-else-if="initials" aria-hidden="true">{{ initials }}</span>
    <UserIcon v-else class="h-4 w-4 opacity-60" aria-hidden="true" />
  </span>
</template>

<script setup lang="ts">
import { UserIcon } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { getInitials } from "~/utils/cast-workspace";

const props = defineProps<{ name: string; src: string | null; large?: boolean }>();
const failed = ref(false);
watch(
  () => props.src,
  () => (failed.value = false),
);
const initials = computed(() => getInitials(props.name));
</script>
