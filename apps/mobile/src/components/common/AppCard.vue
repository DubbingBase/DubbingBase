<template>
  <component
    :is="button || href || clickable ? 'button' : 'div'"
    class="app-card"
    :class="{ 'is-button': button || href || clickable }"
    @click="onClick"
  >
    <slot></slot>
  </component>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = defineProps<{
  button?: boolean;
  clickable?: boolean;
  href?: string;
  replace?: boolean;
}>();

const emit = defineEmits<{
  (e: 'click', event: Event): void;
}>();

const router = useRouter();

const onClick = (event: Event) => {
  if (props.href) {
    if (props.replace) {
      router.replace(props.href);
    } else {
      router.push(props.href);
    }
  }
  emit('click', event);
};
</script>

<style scoped lang="scss">
.app-card {
  display: block;
  margin: 16px;
  width: calc(100% - 32px);
  border-radius: 12px;
  background: var(--app-color-step-50, #1e1e1e);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  text-align: left;
  border: 1px solid var(--app-color-step-100, #2a2a2a);
  padding: 0;
  color: var(--app-color-text-primary, #ffffff);
  font-family: inherit;
  transition: transform 0.2s ease, background-color 0.2s ease;
  
  &.is-button {
    cursor: pointer;
    
    &:hover {
      background: var(--app-color-step-100, #2a2a2a);
    }
    &:active {
      transform: scale(0.98);
    }
  }
}
</style>
