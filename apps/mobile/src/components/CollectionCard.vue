<template>
  <div v-if="collection" class="collection-container">
    <div class="collection-card" @click="isOpen = true">
      <div
        class="collection-backdrop"
        :style="{ backgroundImage: `url(${collection.backdrop_path || collection.poster_path})` }"
      >
        <div class="backdrop-gradient"></div>
      </div>
      <div class="collection-content">
        <h2 class="collection-title">{{ collection.name }}</h2>
        <div class="collection-meta">
          <span class="meta-badge">{{ partsCount }} films</span>
        </div>
      </div>
    </div>

    <ion-modal :is-open="isOpen" @didDismiss="isOpen = false" :initial-breakpoint="0.8" :breakpoints="[0, 0.5, 0.8, 1]">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ collection.name }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="isOpen = false">Fermer</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <p v-if="collection.overview" class="collection-overview">{{ collection.overview }}</p>

        <h3 class="movies-title">Films dans cette collection</h3>
        <div class="movies-list">
          <MediaItem
            v-for="part in collection.parts"
            :key="part.id"
            :imagePath="part.poster_path || undefined"
            :title="part.title"
            routeName="MovieDetails"
            :routeParams="{ id: part.id }"
            @click="isOpen = false"
          />
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent } from '@ionic/vue';
import MediaItem from './MediaItem.vue';

interface Movie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  overview: string;
}

interface Collection {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: Movie[];
}

const props = defineProps<{
  collection?: Collection | null;
}>();

const isOpen = ref(false);

const partsCount = computed(() => {
  return props.collection?.parts?.length || 0;
});
</script>

<style scoped lang="scss">
.collection-container {
  margin: 16px;
}

.collection-card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  height: 120px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--app-overlay-10);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:active {
    transform: scale(0.98);
  }
}

.collection-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-size: cover;
  background-position: center;
  z-index: 0;
}

.backdrop-gradient {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    to right,
    rgba(18, 18, 18, 0.9) 0%,
    rgba(18, 18, 18, 0.6) 50%,
    rgba(18, 18, 18, 0.4) 100%
  );
}

.collection-content {
  position: relative;
  z-index: 1;
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.collection-title {
  margin: 0 0 8px 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.meta-badge {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
  display: inline-block;
}

.collection-overview {
  color: var(--app-color-text-secondary);
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 24px;
}

.movies-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.movies-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 16px;
  padding-bottom: 32px;
}
</style>
