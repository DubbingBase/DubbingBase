<template>
  <span
    class="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border theme-border theme-surface-muted text-xs font-semibold theme-text-secondary"
    :title="name || undefined"
  >
    <NuxtImg
      v-if="src && !failed"
      :src="src"
      alt=""
      width="40"
      height="40"
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

const props = defineProps<{ name: string; src: string | null }>();
const failed = ref(false);
watch(
  () => props.src,
  () => (failed.value = false),
);
const initials = computed(() => getInitials(props.name));
</script>
