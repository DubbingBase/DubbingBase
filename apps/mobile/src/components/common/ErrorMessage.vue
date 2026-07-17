<template>
  <div class="error-container" :class="{ 'inline': inline }">
    <component
      :is="icon"
      class="app-icon"
      :color="color"
      :size="size"
    />
    <div class="error-content">
      <h4 v-if="title" class="error-title">{{ title }}</h4>
      <p class="error-text">{{ message }}</p>
      <AppButton
        v-if="retry"
        fill="outline"
        size="small"
        @click="$emit('retry')"
      >
        <RefreshCw class="app-icon" slot="start"  />
        Réessayer
      </AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue';

import type { Component } from 'vue';
import AlertCircle from '~icons/lucide/alert-circle';
import RefreshCw from '~icons/lucide/refresh-cw';

interface Props {
  message: string
  title?: string
  icon?: Component
  color?: string
  size?: string
  inline?: boolean
  retry?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  icon: () => AlertCircle,
  color: 'danger',
  size: 'large',
  inline: false,
  retry: false
})

defineEmits<{
  retry: []
}>()
</script>

<style scoped>
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem;
  gap: 0.5rem;
}

.error-container.inline {
  flex-direction: row;
  text-align: left;
  gap: 1rem;
}

.error-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.error-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--app-color-danger);
}

.error-text {
  margin: 0;
  color: var(--app-text-color);
  opacity: 0.8;
}
</style>
