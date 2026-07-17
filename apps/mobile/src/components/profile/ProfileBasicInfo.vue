<template>
  <div class="basic-info">
    <h2 class="name">
      {{ voiceActor?.firstname }} {{ voiceActor?.lastname }}
    </h2>

    <div v-if="voiceActor?.voice_actor_name" class="stage-name">
      Nom de scène: {{ voiceActor.voice_actor_name }}
    </div>

    <div class="stats">
      <div class="stat-item">
        <Film class="app-icon"  color="primary" />
        <span>{{ workEntries.length }} projets</span>
      </div>

      <div v-if="voiceActor?.nationality" class="stat-item">
        <Flag class="app-icon"  color="primary" />
        <span>{{ voiceActor.nationality }}</span>
      </div>

      <div v-if="voiceActor?.years_active" class="stat-item">
        <Calendar class="app-icon"  color="primary" />
        <span>{{ voiceActor.years_active }}</span>
      </div>
    </div>

    <div v-if="voiceActor?.bio" class="bio">
      <p>{{ voiceActor.bio }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useProfileStore } from '@/stores/profile'

const profileStore = useProfileStore()

const voiceActor = computed(() => profileStore.voiceActor)
const workEntries = computed(() => profileStore.workEntries)
</script>

<style scoped>
.basic-info {
  text-align: center;
  flex: 1;
}

.name {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--app-color-primary);
}

.stage-name {
  font-size: 0.875rem;
  color: var(--app-color-medium);
  margin-bottom: 1rem;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--app-color-dark);
}

.stat-item .app-icon {
  font-size: 1rem;
}

.bio {
  text-align: left;
  margin-top: 1rem;
}

.bio p {
  margin: 0;
  line-height: 1.5;
  color: var(--app-text-color);
}

@media (min-width: 768px) {
  .basic-info {
    text-align: left;
    margin-left: 1rem;
  }
}
</style>
