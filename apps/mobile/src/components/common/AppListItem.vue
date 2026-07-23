<template>
  <component
    :is="button || href || clickable ? 'button' : 'div'"
    class="app-list-item"
    :class="[
      `lines-${lines}`,
      { 'is-button': button || href || clickable },
      { 'is-disabled': disabled }
    ]"
    :disabled="disabled"
    @click="onClick"
  >
    <div class="item-inner">
      <div v-if="$slots.start" class="item-start">
        <slot name="start"></slot>
      </div>
      
      <div class="item-content">
        <slot></slot>
      </div>

      <div v-if="$slots.end" class="item-end">
        <slot name="end"></slot>
      </div>
      
      <div v-if="detail" class="item-detail-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = withDefaults(defineProps<{
  button?: boolean;
  clickable?: boolean;
  href?: string;
  disabled?: boolean;
  lines?: 'full' | 'none' | 'inset';
  detail?: boolean;
  replace?: boolean;
}>(), {
  button: false,
  clickable: false,
  disabled: false,
  lines: 'inset',
  detail: false,
  replace: false
});

const router = useRouter();

const emit = defineEmits<{
  (e: 'click', event: Event): void;
}>();

const onClick = (event: Event) => {
  if (props.disabled) {
    event.preventDefault();
    return;
  }
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
.app-list-item {
  display: block;
  width: 100%;
  padding: 0;
  margin: 0;
  background: transparent;
  color: var(--app-color-text-primary, #ffffff);
  border: none;
  text-align: left;
  font-family: inherit;
  transition: background-color 0.2s ease;
  
  &.is-button {
    cursor: pointer;
    
    &:hover {
      background: var(--app-overlay-5);
    }
    
    &:active {
      background: var(--app-overlay-10);
    }
  }
  
  &.is-disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  
  /* Lines styling */
  &.lines-full {
    border-bottom: 1px solid var(--app-color-step-150, #2a2a2a);
  }
  
  &.lines-none {
    border-bottom: none;
    .item-inner {
      border-bottom: none;
    }
  }
  
  &.lines-inset {
    border-bottom: none;
  }
}

.item-inner {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 8px 16px;
  width: 100%;
  box-sizing: border-box;
}

/* For inset lines, we apply border to the inner wrapper, but exclude the start padding */
.lines-inset .item-inner {
  border-bottom: 1px solid var(--app-color-step-150, #2a2a2a);
  margin-left: 16px;
  padding-left: 0;
  width: calc(100% - 16px);
}

.app-list-item:last-child .item-inner {
  border-bottom: none;
}
.app-list-item.lines-full:last-child {
  border-bottom: none;
}

.item-start {
  margin-right: 16px;
  display: flex;
  align-items: center;
}

.item-end {
  margin-left: 16px;
  display: flex;
  align-items: center;
}

.item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0; /* Important for text truncation inside */
}

.item-detail-icon {
  margin-left: 8px;
  color: var(--app-color-step-400, #999999);
  display: flex;
  align-items: center;
  
  svg {
    width: 20px;
    height: 20px;
  }
}
</style>
