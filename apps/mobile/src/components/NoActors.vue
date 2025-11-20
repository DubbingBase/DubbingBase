<template>
  <div class="no-actors">No actors found for this movie.</div>
</template>

<script setup lang="ts">
// No props needed
</script>

<style scoped lang="scss">
.no-actors {
  color: #b0b0b0;
  font-style: italic;
  text-align: center;
  display: flex;
  justify-content: center;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 16px;
  background: #16213e;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 14px;
  font-weight: 500;

  @media (max-width: 768px) {
    padding: 12px;
    font-size: 12px;
  }
}
</style>
