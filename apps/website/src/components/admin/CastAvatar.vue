<template>
  <span
    class="relative inline-flex shrink-0 items-center justify-center overflow-hidden border theme-border theme-surface-muted font-semibold theme-text-secondary"
    :class="sizeClass"
    :title="name || undefined"
  >
    <NuxtImg
      v-if="src && !failed"
      :src="src"
      alt=""
      :width="dimensions.width"
      :height="dimensions.height"
      format="webp"
      loading="lazy"
      decoding="async"
      class="h-full w-full object-cover"
      @error="onError"
    />
    <span v-else-if="initials" aria-hidden="true">{{ initials }}</span>
    <UserIcon v-else class="h-4 w-4 opacity-60" aria-hidden="true" />
  </span>
</template>

<script setup lang="ts">
import { UserIcon } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { getInitials } from "~/utils/cast-workspace";

/** Rounded squares; `md` is the size shared by the character, actor and voice-actor portraits. */
const props = defineProps<{ name: string; src: string | null; size?: "sm" | "md" }>();
const emit = defineEmits<{ error: [] }>();
const failed = ref(false);
watch(
  () => props.src,
  () => (failed.value = false),
);
const onError = () => {
  failed.value = true;
  emit("error");
};
const initials = computed(() => getInitials(props.name));

const SIZES = {
  md: { classes: "h-14 w-14 rounded-xl text-base", width: 56, height: 56 },
  sm: { classes: "h-10 w-10 rounded-xl text-xs", width: 40, height: 40 },
} as const;
const dimensions = computed(() => SIZES[props.size ?? "sm"]);
const sizeClass = computed(() => dimensions.value.classes);
</script>
