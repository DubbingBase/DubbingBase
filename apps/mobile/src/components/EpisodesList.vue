<template>
  <ion-list v-if="episodes && episodes.length">
    <ion-item
      v-for="ep in episodes"
      :key="ep.id"
      class="episode-item"
      @click="goToEpisode(ep.episode_number)"
    >
      <MediaItem
        v-if="ep.still_path"
        :imagePath="ep.still_path"
        :title="ep.name"
        :routeName="'SeasonByEpisodes'"
        :routeParams="{id: ep.id, season: ep.season_number, episode: ep.episode_number}"
        :loading="false"
      />
      <ion-label>
        <h2>{{ ep.episode_number }}. {{ ep.name }}</h2>
        <p v-if="ep.air_date">Diffusé le {{ ep.air_date }}</p>
        <p v-if="ep.overview">{{ ep.overview }}</p>
      </ion-label>
    </ion-item>
  </ion-list>
  <div v-else>Aucun épisode trouvé.</div>
</template>

<script lang="ts" setup>
import { IonList, IonItem, IonLabel } from "@ionic/vue";
import MediaItem from "@/components/MediaItem.vue";

interface Props {
  episodes: any[];
  goToEpisode: (episodeNumber: number) => void;
}

defineProps<Props>();
</script>

<style lang="scss" scoped>
.episode-item {
  margin-bottom: 0.5rem;
}
</style>
