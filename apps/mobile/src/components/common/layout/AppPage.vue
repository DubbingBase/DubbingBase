<template>
  <div class="app-page">
    <slot></slot>
  </div>
</template>

<style scoped>
.app-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  background: var(--app-color-step-50, #121212);
  color: var(--app-color-step-900, #ffffff);
  overflow: hidden;
  position: relative;
}
</style>
