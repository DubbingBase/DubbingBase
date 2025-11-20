<template>
  <div class="banner">
    <MediaItem
      v-if="season.poster_path"
      :imagePath="season.poster_path"
      :title="season.name"
      :routeName="'SeasonDetails'"
      :routeParams="{ id: serieId, season: seasonNumber }"
      :loading="false"
    />
    <div class="meta">
      <h2>{{ season.name }}</h2>
      <div class="subtitle">
        <span v-if="season.air_date">Première diffusion : {{ season.air_date }}</span>
        <span v-if="season.episode_count">• {{ season.episode_count }} épisodes</span>
      </div>
      <div class="overview" v-if="season.overview">
        {{ season.overview }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import MediaItem from "@/components/MediaItem.vue";

interface Props {
  season: any;
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

  .poster {
    width: 120px;
    border-radius: 8px;
    box-shadow: 0 2px 8px #0003;
  }

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
