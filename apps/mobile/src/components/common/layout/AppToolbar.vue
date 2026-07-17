<template>
  <div class="app-toolbar">
    <div class="toolbar-start">
      <slot name="start"></slot>
    </div>
    <div class="toolbar-content">
      <slot></slot>
    </div>
    <div class="toolbar-end">
      <slot name="end"></slot>
    </div>
  </div>
</template>

<style scoped>
.app-toolbar {
  display: flex;
  align-items: center;
  min-height: 56px;
  padding: 0 8px;
  width: 100%;
}

.toolbar-start, .toolbar-end {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 48px;
}

.toolbar-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0 8px;
}
</style>
