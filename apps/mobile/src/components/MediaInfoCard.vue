<template>
  <div v-if="media" class="immersive-media-header">
    <div
      class="immersive-backdrop"
      :style="{ backgroundImage: `url(${getTmdbImageUrl(media.backdrop_path || media.poster_path, 'w1280')})` }"
    >
      <div class="backdrop-gradient"></div>
    </div>

    <div class="header-content">
      <div class="top-row">
        <div class="poster-container">
          <MediaItem
            v-if="media.poster_path"
            :imagePath="media.poster_path"
            :routeName="media.title ? 'MovieDetails' : 'SerieDetails'"
            :routeParams="{ id: media.id }"
            class="media-poster"
          />
        </div>
        
        <div class="title-and-meta">
          <h1 class="media-title">{{ media.title || media.name }}</h1>
          
          <div class="primary-meta">
            <div v-if="media.vote_average" class="rating-pill">
              <ion-icon :icon="star" class="star-icon"></ion-icon>
              <span>{{ media.vote_average.toFixed(1) }}</span>
            </div>
            <div v-if="(media as SerieType).status" class="meta-badge">
              {{ (media as SerieType).status }}
            </div>
            <div v-if="(media as SerieType).seasons?.length" class="meta-badge">
              {{ (media as SerieType).seasons?.length }} saisons
            </div>
            <div v-if="media.release_date || (media as SerieType).first_air_date" class="year-pill">
              {{ formatDate(media.release_date || (media as SerieType).first_air_date) }}
            </div>
            <div v-if="(media as MovieType).runtime && !(media as SerieType).first_air_date" class="year-pill">
              {{ (media as MovieType).runtime }} min
            </div>
          </div>
        </div>
      </div>

      <div v-if="media.genres && media.genres.length" class="media-genres">
        <span v-for="genre in media.genres" :key="genre.id" class="media-genre-chip">{{ genre.name }}</span>
      </div>

      <div class="metadata-row">
        <!-- External Services -->
        <a 
          :href="`https://www.themoviedb.org/${media.title ? 'movie' : 'tv'}/${media.id}`" 
          target="_blank" 
          class="meta-pill link-pill tmdb-pill"
        >
          <ion-icon :icon="openOutline"></ion-icon>
          <span>TMDB</span>
        </a>

        <a 
          v-if="media.external_ids?.imdb_id" 
          :href="`https://www.imdb.com/title/${media.external_ids.imdb_id}`" 
          target="_blank" 
          class="meta-pill link-pill imdb-pill"
        >
          <ion-icon :icon="openOutline"></ion-icon>
          <span>IMDb</span>
        </a>

        <a 
          v-if="media.external_ids?.wikidata_id" 
          :href="`https://hub.toolforge.org/${media.external_ids.wikidata_id}?site=enwiki`" 
          target="_blank" 
          class="meta-pill link-pill wikidata-pill"
        >
          <ion-icon :icon="bookOutline"></ion-icon>
          <span>Wikipedia</span>
        </a>
      </div>

      <div class="overview-card" v-if="media.overview">
        <p class="overview-text" :class="{ 'expanded': isOverviewExpanded }" ref="overviewRef">
          {{ media.overview }}
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

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { IonIcon } from '@ionic/vue';
import { timeOutline, globeOutline, calendarOutline, bookOutline, star, informationCircleOutline, albumsOutline, openOutline } from 'ionicons/icons';
import { useI18n } from 'vue-i18n';
import { format } from 'date-fns';
import MediaItem from './MediaItem.vue';

const { t } = useI18n();

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  try {
    return format(new Date(dateString), "MMM dd, yyyy");
  } catch (e) {
    return dateString;
  }
};

type ExternalIds = {
  wikidata_id?: string;
  imdb_id?: string;
  facebook_id?: string;
  instagram_id?: string;
  twitter_id?: string;
};

type MovieType = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  vote_average?: number;
  original_language?: string;
  release_date?: string;
  runtime?: number;
  genres?: { id: number; name: string }[];
  external_ids?: ExternalIds;
};

type SerieType = {
  id: number;
  name?: string;
  title?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  vote_average?: number;
  original_language?: string;
  release_date?: string;
  first_air_date?: string;
  last_air_date?: string;
  genres?: { id: number; name: string }[];
  status?: string;
  seasons?: any[];
  external_ids?: ExternalIds;
  credits?: { cast?: any[] };
};

type MediaType = MovieType | SerieType;

interface Props {
  media: MediaType | undefined;
}

const props = defineProps<Props>();

const getTmdbImageUrl = (path: string | undefined, size = 'w1280') => {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

const getYear = (dateString?: string) => {
  if (!dateString) return '';
  return dateString.substring(0, 4);
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

watch(() => props.media?.overview, checkOverviewTruncation);
onMounted(checkOverviewTruncation);

</script>

<style scoped lang="scss">
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
  border: 1px solid rgba(255, 255, 255, 0.1);
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

.rating-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 193, 7, 0.15);
  color: #ffc107;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.95rem;
  border: 1px solid rgba(255, 193, 7, 0.3);

  .star-icon {
    font-size: 1.1rem;
  }
}

.year-pill {
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.1rem;
  font-weight: 600;
}

.meta-badge {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.media-genres {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 20px;
  margin-left: -16px;
  margin-right: -16px;
  padding-left: 16px;
  padding-right: 16px;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.media-genre-chip {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 500;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  white-space: nowrap;
  flex-shrink: 0;
}

.metadata-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  margin-bottom: 24px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-left: -16px;
  margin-right: -16px;
  padding-left: 16px;
  padding-right: 16px;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.meta-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(20, 20, 20, 0.8);
  padding: 6px 14px;
  border-radius: 12px;
  font-size: 0.9rem;
  color: var(--ion-color-medium-tint);
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  white-space: nowrap;
  flex-shrink: 0;

  ion-icon {
    font-size: 1.1rem;
  }
}

.link-pill {
  text-decoration: none;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
}

.tmdb-pill {
  color: #01b4e4;
  background: rgba(1, 180, 228, 0.1);
  border-color: rgba(1, 180, 228, 0.2);

  &:hover {
    background: rgba(1, 180, 228, 0.2);
  }
}

.imdb-pill {
  color: #f5c518;
  background: rgba(245, 197, 24, 0.1);
  border-color: rgba(245, 197, 24, 0.2);

  &:hover {
    background: rgba(245, 197, 24, 0.2);
  }
}

.wikidata-pill {
  color: var(--ion-color-primary-tint);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  border-color: rgba(var(--ion-color-primary-rgb), 0.2);

  &:hover {
    background: rgba(var(--ion-color-primary-rgb), 0.2);
  }
}

.overview-card {
  background: rgba(20, 20, 20, 0.6);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}

.overview-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  
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
  color: var(--ion-color-primary);
  font-weight: 600;
  padding: 8px 0 0 0;
  margin-top: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}
</style>
