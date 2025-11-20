<template>
  <div class="voice-actor-bio" v-if="bio">
    <h3>Biographie</h3>
    <p>{{ bio }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  bio: string | null;
}

defineProps<Props>();
</script>

<style scoped lang="scss">
.voice-actor-bio {
  padding: 12px;
  background: var(--ion-color-card);
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--ion-color-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

  h3 {
    margin: 0 0 8px 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--ion-color-primary);
  }

  p {
    margin: 0;
    line-height: 1.6;
    font-size: 0.95rem;
    color: var(--ion-color-text-secondary);
    text-align: left;
  }
}
</style>
