<template>
  <div v-if="props.overlay" class="loading-overlay">
    <div class="spinner-container">
      <AppSpinner :name="props.name" :color="props.color" :size="props.size" />
      <div v-if="props.message" class="loading-message">{{ props.message }}</div>
    </div>
  </div>
  <div v-else-if="props.inline" class="loading-inline">
    <AppSpinner :name="props.name" :color="props.color" :size="props.size" />
    <span v-if="props.message" class="loading-message-inline">{{ props.message }}</span>
  </div>
  <div v-else class="loading-default">
    <AppSkeleton v-if="props.useSkeleton" class="loading-skeleton" />
    <template v-else>
      <AppSpinner :name="props.name" :color="props.color" :size="props.size" />
      <div v-if="props.message" class="loading-message">{{ props.message }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import AppSpinner from '@/components/common/AppSpinner.vue';
import AppSkeleton from '@/components/common/AppSkeleton.vue';

interface Props {
  name?: 'crescent' | 'bubbles' | 'circles' | 'circular' | 'dots' | 'lines' | 'lines-small' | 'lines-sharp' | 'lines-sharp-small'
  color?: string
  size?: string
  inline?: boolean
  overlay?: boolean
  useSkeleton?: boolean
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  name: 'crescent',
  color: 'primary',
  size: undefined,
  inline: false,
  overlay: false,
  useSkeleton: false,
  message: undefined
})
</script>

<style scoped>
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--app-color-step-50, 0, 0, 0), 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: var(--app-color-step-100, #1e1e1e);
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.loading-message {
  margin-top: 8px;
  font-size: 14px;
  color: var(--app-color-step-600, #999);
  text-align: center;
}

.loading-message-inline {
  margin-left: 8px;
  font-size: 14px;
  color: var(--app-color-step-600, #999);
}

.loading-default {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
}

.loading-container.inline {
  flex-direction: row;
  min-height: auto;
  gap: 0.5rem;
}

.loading-text {
  font-size: 0.875rem;
  color: var(--app-color-medium);
}
</style>
