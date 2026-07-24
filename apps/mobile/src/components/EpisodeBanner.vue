<template>
  <div class="immersive-media-header">
    <div
      v-if="episode.still_path"
      class="immersive-backdrop"
      :style="{ backgroundImage: `url(${getTmdbImageUrl(episode.still_path, 'w1280')})` }"
    >
      <div class="backdrop-gradient"></div>
    </div>

    <div class="header-content" :class="{ 'no-image': !episode.still_path }">
      <div class="top-row">
        <div class="title-and-meta">
          <h1 class="media-title">Épisode {{ episode.episode_number }}: {{ episode.name }}</h1>

          <div class="primary-meta">
            <div v-if="episode.air_date" class="year-pill">
              Diffusé le {{ formatDate(episode.air_date) }}
            </div>
          </div>
        </div>
      </div>

      <div class="overview-card" v-if="episode.overview">
        <p class="overview-text" :class="{ 'expanded': isOverviewExpanded }" ref="overviewRef">
          {{ episode.overview }}
        </p>
        <button 
          v-if="showOverviewToggle" 
          class="toggle-overview-btn" 
          @click="isOverviewExpanded = !isOverviewExpanded"
        >
          {{ isOverviewExpanded ? 'Moins' : 'Plus' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import { format } from 'date-fns';

interface Props {
  episode: {
    episode_number: number;
    name: string;
    air_date?: string;
    overview?: string;
    still_path?: string;
  };
  serieId: number;
  seasonNumber: number;
}

const props = defineProps<Props>();

const isOverviewExpanded = ref(false);
const overviewRef = ref<HTMLElement | null>(null);
const showOverviewToggle = ref(false);

const getTmdbImageUrl = (path: string | undefined, size = 'w1280') => {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

const checkOverviewContent = () => {
  if (overviewRef.value) {
    showOverviewToggle.value = overviewRef.value.scrollHeight > overviewRef.value.clientHeight;
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  try {
    return format(new Date(dateString), "MMM dd, yyyy");
  } catch (e) {
    return dateString;
  }
};

onMounted(() => {
  setTimeout(checkOverviewContent, 100);
});

watch(() => props.episode, () => {
  nextTick(() => {
    setTimeout(checkOverviewContent, 100);
  });
}, { deep: true });
</script>

<style lang="scss" scoped>
.immersive-media-header {
  position: relative;
  margin: -16px -16px 24px -16px;
  background: var(--app-background);
}

.immersive-backdrop {
  height: 240px;
  background-size: cover;
  background-position: center;
  position: relative;
  width: 100%;

  .backdrop-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(var(--app-background-rgb, 18, 18, 18), 0.2) 40%,
      rgba(var(--app-background-rgb, 18, 18, 18), 0.8) 70%,
      var(--app-background) 100%
    );
  }
}

.header-content {
  position: relative;
  padding: 0 16px;
  margin-top: -60px;
  z-index: 2;
  
  &.no-image {
    margin-top: 32px;
  }
}

.top-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  margin-bottom: 20px;
}

.title-and-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 4px;
}

.media-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0;
  line-height: 1.2;
  color: var(--app-color-text-primary);
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}

.primary-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.year-pill {
  background: var(--app-overlay-10);
  color: var(--app-color-text-primary);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
  border: 1px solid var(--app-overlay-5);
}

.overview-card {
  background: var(--app-color-step-100);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid var(--app-color-border-light);
  backdrop-filter: blur(10px);
}

.overview-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--app-color-text-secondary);

  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
  transition: all 0.3s ease;

  &.expanded {
    -webkit-line-clamp: unset;
    display: block;
  }
}

.toggle-overview-btn {
  background: transparent;
  border: none;
  color: var(--app-color-primary);
  font-weight: 600;
  padding: 8px 0 0 0;
  margin-top: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}
</style>
