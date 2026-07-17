<template>
  <div class="app-avatar" :class="size ? `size-${size}` : ''">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  size?: 'small' | 'medium' | 'large' | 'xlarge';
}>();
</script>

<style scoped lang="scss">
.app-avatar {
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-step-100, #2a2a2a);
  flex-shrink: 0;

  width: 48px;
  height: 48px;

  &.size-small {
    width: 32px;
    height: 32px;
  }
  
  &.size-medium {
    width: 48px;
    height: 48px;
  }
  
  &.size-large {
    width: 64px;
    height: 64px;
  }
  
  &.size-xlarge {
    width: 120px;
    height: 120px;
  }

  :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
</style>
