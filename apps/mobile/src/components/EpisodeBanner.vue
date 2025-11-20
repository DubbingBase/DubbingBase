<template>
  <div class="banner">
    <MediaItem
      v-if="episode.still_path"
      :imagePath="episode.still_path"
      :title="episode.name"
      :routeName="'SeasonByEpisodes'"
      :routeParams="{id: serieId, season: seasonNumber, episode: episode.episode_number}"
      :loading="false"
    />
    <div class="meta">
      <h2>Episode {{ episode.episode_number }}: {{ episode.name }}</h2>
      <div class="subtitle">
        <span v-if="episode.air_date">Diffusé le {{ episode.air_date }}</span>
      </div>
      <div class="overview" v-if="episode.overview">
        {{ episode.overview }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import MediaItem from "@/components/MediaItem.vue";

interface Props {
  episode: any;
  serieId: number;
  seasonNumber: number;
}

defineProps<Props>();
</script>

<style lang="scss" scoped>
.banner {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 1.5rem;


  .meta {
    flex: 1;

    h2 {
      margin: 0 0 0.5rem 0;
    }

    .subtitle {
      color: #888;
      font-size: 0.95em;
      margin-bottom: 0.5rem;

      span + span {
        margin-left: 1em;
      }
    }

    .overview {
      margin-top: 0.5rem;
    }
  }
}
</style>
