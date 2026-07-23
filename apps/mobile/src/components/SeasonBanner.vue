<template>
  <div class="immersive-media-header" v-if="season">
    <div
      class="immersive-backdrop"
      :style="{ backgroundImage: `url(${getTmdbImageUrl(season.poster_path, 'w1280')})` }"
    >
      <div class="backdrop-gradient"></div>
    </div>

    <div class="header-content">
      <div class="top-row">
        <div class="poster-container">
          <MediaItem
            v-if="season.poster_path"
            :imagePath="season.poster_path"
            :routeName="'SeasonDetails'"
            :routeParams="{ id: serieId, season: seasonNumber }"
            :loading="false"
            class="media-poster"
          />
        </div>
        
        <div class="title-and-meta">
          <h1 class="media-title">{{ season.name }}</h1>
          
          <div class="primary-meta">
            <div v-if="season.air_date" class="year-pill">
              {{ formatDate(season.air_date) }}
            </div>
            <div v-if="season.episode_count" class="meta-badge">
              {{ season.episode_count }} épisodes
            </div>
          </div>
        </div>
      </div>

      <div class="overview-card" v-if="season.overview">
        <p class="overview-text" :class="{ 'expanded': isOverviewExpanded }" ref="overviewRef">
          {{ season.overview }}
        </p>
        <button 
          v-if="showOverviewToggle" 
          class="toggle-overview-btn" 
          @click="isOverviewExpanded = !isOverviewExpanded"
        >
          {{ isOverviewExpanded ? t('common.showLess', 'Show less') : t('common.readMore', 'Read more') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { format } from 'date-fns';
import MediaItem from "@/components/MediaItem.vue";

interface Props {
  season: {
    name: string;
    air_date?: string;
    episode_count?: number;
    overview?: string;
    poster_path?: string;
  };
  serieId: number;
  seasonNumber: number;
}

const props = defineProps<Props>();

const { t } = useI18n();

const getTmdbImageUrl = (path: string | undefined, size = 'w1280') => {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  try {
    return format(new Date(dateString), "MMM dd, yyyy");
  } catch (e) {
    return dateString;
  }
};

const isOverviewExpanded = ref(false);
const showOverviewToggle = ref(false);
const overviewRef = ref<HTMLElement | null>(null);

const checkOverviewTruncation = async () => {
  await nextTick();
  if (overviewRef.value) {
    const el = overviewRef.value;
    showOverviewToggle.value = el.scrollHeight > el.clientHeight || el.scrollHeight > 80;
  }
};

watch(() => props.season?.overview, checkOverviewTruncation);
onMounted(checkOverviewTruncation);

</script>

<style lang="scss" scoped>
.immersive-media-header {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.immersive-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 280px;
  background-size: cover;
  background-position: center;
  z-index: 0;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -10%; left: -10%; right: -10%; bottom: -10%;
    background: inherit;
    filter: blur(12px) brightness(0.4);
  }

  .backdrop-gradient {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(
      to bottom,
      rgba(18, 18, 18, 0) 0%,
      rgba(18, 18, 18, 0.8) 60%,
      rgba(18, 18, 18, 1) 100%
    );
  }
}

.header-content {
  position: relative;
  z-index: 1;
  padding: 24px 16px 16px;
  margin-top: 40px;
}

.top-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  margin-bottom: 20px;
}

.poster-container {
  flex-shrink: 0;
  width: 130px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--app-overlay-10);
  overflow: hidden;

  :deep(ion-img::part(image)),
  :deep(img) {
    border-radius: 12px;
  }
}

.title-and-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 4px;
}

.media-title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.2;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.primary-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.year-pill {
  color: var(--app-color-text-secondary);
  font-size: 1.1rem;
  font-weight: 600;
}

.meta-badge {
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

