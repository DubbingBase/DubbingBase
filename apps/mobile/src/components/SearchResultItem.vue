<template>
  <router-link class="no-link" :to="{
      name: routeName,
      params: { id: match.id },
    }">
  <ion-card
    class="search-result-card"
    button
  >
    <ion-card-content class="card-content">
      <MediaThumbnail :path="image ?? `https://api.dicebear.com/9.x/initials/svg?scale=50&backgroundColor=212121&seed=${name}`" class="thumbnail" />
      <div class="info">
        <h3 class="title">{{ name }}</h3>
        <p class="subtitle">{{ formattedDate }}</p>
        <div v-if="chips.length" class="chips">
          <ion-chip v-for="chip in chips" :key="chip">{{ chip }}</ion-chip>
        </div>
      </div>
      <ion-icon v-if="mediaIcon" :icon="mediaIcon" :color="iconColor" class="type-icon"></ion-icon>
    </ion-card-content>
  </ion-card>
  </router-link>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import {
  IonCard,
  IonCardContent,
  IonChip,
  IonIcon,
} from "@ionic/vue";
import { tvOutline, personOutline, micOutline, filmOutline } from "ionicons/icons";
import { format, parseISO } from 'date-fns';
import MediaThumbnail from "@/components/MediaThumbnail.vue";
import type { SearchResult } from "@/types/search";

interface Props {
  match: SearchResult;
}

const props = defineProps<Props>();

const image = computed(() => {
  return props.match.profile_path ?? props.match.poster_path;
});

const name = computed(() => {
  return props.match.name ?? props.match.title ?? (props.match.firstname ?? '') + ' ' + (props.match.lastname ?? '');
});

const formattedDate = computed(() => {
  const date = props.match.first_air_date ?? props.match.release_date;
  if (date) {
    return format(parseISO(date), 'yyyy');
  }
  return '';
});

const routeName = computed(() => {
  switch (props.match.media_type) {
    case "movie":
      return "MovieDetails";
    case "tv":
      return "SerieDetails";
    case "person":
      return "ActorDetails";
    case "voice_actor":
      return "VoiceActorDetails";
    default:
      return "home";
  }
});

const mediaIcon = computed(() => {
  switch (props.match.media_type) {
    case "movie": return filmOutline;
    case "tv": return tvOutline;
    case "person": return personOutline;
    case "voice_actor": return micOutline;
    default: return undefined;
  }
});

const iconColor = computed(() => {
  switch (props.match.media_type) {
    case "movie": return "danger";
    case "tv": return "primary";
    case "person": return "warning";
    case "voice_actor": return "success";
    default: return "medium";
  }
});

const chips = computed(() => {
  const result: string[] = [];
  switch (props.match.media_type) {
    case "voice_actor":
      if (props.match.nationality) {
        result.push(props.match.nationality);
      }
      if (props.match.years_active) {
        result.push(props.match.years_active);
      }
      if (props.match.awards) {
        result.push(props.match.awards);
      }
      break;
  }
  return result;
});

</script>

<style lang="scss" scoped>
.search-result-card {
  margin: 8px 0;
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.type-icon {
  flex-shrink: 0;
  font-size: 22px;
  margin-left: 8px;
  align-self: center;
}

.card-content {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.thumbnail {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  object-fit: cover;
}

.info {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitle {
  font-size: 14px;
  margin: 0 0 8px 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}


// Responsive design
@media (max-width: 576px) {
  .card-content {
    padding: 12px;
    gap: 12px;
  }

  .thumbnail {
    width: 60px;
    height: 60px;
  }

  .title {
    font-size: 16px;
  }

  .subtitle {
    font-size: 13px;
  }

  .chips {
    gap: 2px;
  }

}
</style>
