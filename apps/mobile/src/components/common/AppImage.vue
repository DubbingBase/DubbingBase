<template>
  <img 
    :src="src" 
    :alt="alt" 
    class="app-image" 
    @error="handleError"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  src?: string;
  alt?: string;
}>();

const hasError = ref(false);
const handleError = () => {
  hasError.value = true;
};
</script>

<style scoped>
.app-image {
  max-width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}
</style>
