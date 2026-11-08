<template>
  <img
    v-if="image"
    :key="image.src"
    :src="image.src"
    :alt="alt"
    :title="image.attribution"
    :data-character-image-source="image.source"
    class="w-full h-full object-cover"
    loading="lazy"
    decoding="async"
    referrerpolicy="no-referrer"
    @error="emit('error')"
  />
  <slot v-else />
</template>

<script setup lang="ts">
import type { CharacterImage } from "../composables/useCharacterImages";

defineProps<{ image: CharacterImage | null; alt: string }>();
const emit = defineEmits<{ error: [] }>();
</script>
