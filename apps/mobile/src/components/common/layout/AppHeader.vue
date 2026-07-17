<template>
  <header class="app-header">
    <slot></slot>
  </header>
</template>

<style scoped>
.app-header {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  padding-top: env(safe-area-inset-top);
  background: var(--app-color-step-50, #121212);
  z-index: 10;
}
</style>
