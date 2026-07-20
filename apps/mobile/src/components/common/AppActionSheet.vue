<template>
  <ion-action-sheet
    :is-open="isOpen"
    :header="header"
    :buttons="formattedButtons"
    css-class="custom-dark-action-sheet"
    @didDismiss="isOpen = false"
  ></ion-action-sheet>
</template>

<script setup lang="ts">
import { computed, h, render } from 'vue';
import { IonActionSheet } from '@ionic/vue';

export interface ActionSheetButton {
  text: string;
  icon?: any;
  role?: 'destructive' | 'cancel' | string;
  handler?: () => void;
}

const props = defineProps<{
  isOpen: boolean;
  header?: string;
  buttons: ActionSheetButton[];
}>();

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void;
  (e: 'didDismiss'): void;
}>();

const isOpen = computed({
  get: () => props.isOpen,
  set: (val) => {
    emit('update:isOpen', val);
    if (!val) emit('didDismiss');
  }
});

const getSvgStringFromComponent = (component: any) => {
  if (!component) return undefined;
  if (typeof component === 'string') return component; // Already an SVG string or icon name

  try {
    const div = document.createElement('div');
    const vnode = h(component, {
      width: '24px',
      height: '24px',
      stroke: 'currentColor'
    });
    render(vnode, div);
    let svgString = div.innerHTML.replace(/currentColor/g, '#ffffff');
    if (!svgString.includes('xmlns=')) {
      svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return `data:image/svg+xml;utf8,${svgString}`;
  } catch (e) {
    console.error('Failed to convert Vue component to SVG string', e);
    return undefined;
  }
};

const formattedButtons = computed(() => {
  const finalButtons: any[] = props.buttons.map(btn => ({
    text: btn.text,
    role: btn.role,
    icon: getSvgStringFromComponent(btn.icon),
    handler: btn.handler
  }));

  // Add a cancel button if not explicitly provided
  if (!finalButtons.some(b => b.role === 'cancel')) {
    finalButtons.push({
      text: 'Cancel',
      role: 'cancel'
    });
  }

  return finalButtons;
});
</script>

<style>
.custom-dark-action-sheet {
  --background: var(--app-color-step-50, #1e1e1e);
  --button-background: var(--app-color-step-100, #2d2d2d);
  --button-background-selected: var(--app-color-step-200, #3d3d3d);
  --button-color: var(--app-color-text-primary, #ffffff);
  --color: var(--app-color-medium, #92949c);
}

.custom-dark-action-sheet .action-sheet-cancel {
  --button-background: var(--app-color-step-200, #3d3d3d);
  --button-color: var(--app-color-text-primary, #ffffff);
  font-weight: 600;
}

.custom-dark-action-sheet .action-sheet-destructive {
  --button-color: var(--app-color-danger, #ef4444);
}
</style>
