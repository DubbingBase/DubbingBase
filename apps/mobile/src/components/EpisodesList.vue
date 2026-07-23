<template>
  <div class="episodes-list" v-if="episodes && episodes.length">
    <div
      v-for="ep in episodes"
      :key="ep.id"
      class="episode-item"
      @click="goToEpisode(ep.episode_number)"
    >
      <MediaItem
        v-if="ep.still_path"
        :imagePath="getTmdbImageUrl(ep.still_path)"
        :loading="false"
        :width="142"
        :height="80"
        class="episode-thumbnail"
      />
      <div class="episode-info">
        <div class="episode-name">{{ ep.episode_number }}. {{ ep.name }}</div>
        <div class="episode-subtitle" v-if="ep.air_date">Diffusé le {{ formatDate(ep.air_date) }}</div>
        <div class="episode-overview" v-if="ep.overview">{{ ep.overview }}</div>
      </div>
    </div>
  </div>
  <div v-else class="empty-state">Aucun épisode trouvé.</div>
</template>

<script lang="ts" setup>
import { format } from "date-fns";
import MediaItem from "@/components/MediaItem.vue";

interface Props {
  episodes: {
    id: number;
    episode_number: number;
    season_number: number;
    name: string;
    air_date?: string;
    overview?: string;
    still_path?: string;
  }[];
  goToEpisode: (episodeNumber: number) => void;
}

defineProps<Props>();

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  try {
    return format(new Date(dateString), "MMM dd, yyyy");
  } catch (e) {
    return dateString;
  }
};

const getTmdbImageUrl = (path: string | undefined, size = 'w500') => {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};
</script>

<style lang="scss" scoped>
.episodes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}

.episode-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  background: var(--app-overlay-2);
  transition: all 0.3s ease;
  cursor: pointer;

  &:active {
    background: var(--app-overlay-5);
  }
}

.episode-thumbnail {
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
}

.episode-info {
  flex: 1;
  min-width: 0;

  .episode-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--app-color-text-primary);
    line-height: 1.4;
    margin-bottom: 2px;
  }

  .episode-subtitle {
    font-size: 12px;
    color: var(--app-color-text-muted, #b0b0b0);
    line-height: 1.2;
    margin-bottom: 4px;
  }

  .episode-overview {
    font-size: 11px;
    color: var(--app-color-text-secondary, #8e8e8e);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.empty-state {
  padding: 16px;
  text-align: center;
  color: var(--app-color-text-muted);
}
</style>
