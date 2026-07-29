<template>
  <div class="max-w-7xl mx-auto px-6 py-24">
    <h1 class="text-4xl font-extrabold text-gray-900 dark:text-white mb-6">{{ t('footer.series') }}</h1>
    <p class="text-gray-500 dark:text-gray-400">This page is under construction.</p>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
const { t } = useI18n();
</script>
