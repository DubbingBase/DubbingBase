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
        <ion-icon name="film" color="primary"></ion-icon>
        <span>{{ workEntries.length }} projets</span>
      </div>

      <div v-if="voiceActor?.nationality" class="stat-item">
        <ion-icon name="flag" color="primary"></ion-icon>
        <span>{{ voiceActor.nationality }}</span>
      </div>

      <div v-if="voiceActor?.years_active" class="stat-item">
        <ion-icon name="calendar" color="primary"></ion-icon>
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
import { IonIcon } from '@ionic/vue'
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
  color: var(--ion-color-primary);
}

.stage-name {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
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
  color: var(--ion-color-dark);
}

.stat-item ion-icon {
  font-size: 1rem;
}

.bio {
  text-align: left;
  margin-top: 1rem;
}

.bio p {
  margin: 0;
  line-height: 1.5;
  color: var(--ion-text-color);
}

@media (min-width: 768px) {
  .basic-info {
    text-align: left;
    margin-left: 1rem;
  }
}
</style>
