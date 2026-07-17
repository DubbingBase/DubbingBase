<template>
  <div class="app-title">
    <slot></slot>
  </div>
</template>

<style scoped>
.app-title {
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  color: var(--app-color-step-900, #ffffff);
}
</style>
