<template>
  <div class="app-toast-container">
    <TransitionGroup name="toast">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        class="app-toast" 
        :class="toast.color ? `toast-${toast.color}` : ''"
      >
        <div class="toast-content">{{ toast.message }}</div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

export interface ToastOptions {
  message: string;
  duration?: number;
  position?: 'top' | 'bottom' | 'middle';
  color?: string;
}

export interface ToastInstance extends ToastOptions {
  id: number;
}

const toasts = ref<ToastInstance[]>([]);
let nextId = 0;

const addToast = (options: ToastOptions) => {
  const id = nextId++;
  const toast = { ...options, id };
  toasts.value.push(toast);
  
  if (options.duration !== 0) {
    setTimeout(() => {
      removeToast(id);
    }, options.duration || 2000);
  }
};

const removeToast = (id: number) => {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    (window as any).__addToast = addToast;
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    delete (window as any).__addToast;
  }
});
</script>

<style scoped lang="scss">
.app-toast-container {
  position: fixed;
  bottom: 24px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  z-index: 10000;
  gap: 8px;
}

.app-toast {
  background: var(--app-color-step-150, #3a3a3a);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  pointer-events: auto;
  min-width: 250px;
  text-align: center;
  max-width: 90vw;
  
  &.toast-success {
    background: var(--app-color-success, #2fdf75);
    color: var(--app-color-success-contrast, #fff);
  }
  &.toast-danger {
    background: var(--app-color-danger, #ff4961);
    color: var(--app-color-danger-contrast, #fff);
  }
  &.toast-warning {
    background: var(--app-color-warning, #ffd534);
    color: var(--app-color-warning-contrast, #000);
  }
  &.toast-primary {
    background: var(--app-color-primary, #3880ff);
    color: var(--app-color-primary-contrast, #fff);
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}
</style>
