<template>
  <router-link class="no-link" :to="{
      name: routeName,
      params: { id: match.id },
    }">
  <AppCard
    class="search-result-card"
    button
  >
    <AppCardContent class="card-content">
      <MediaThumbnail :path="image" :fallbackPath="getAvatarFallbackUrl(name)" class="thumbnail" />
      <div class="info">
        <h3 class="title">{{ name }}</h3>
        <p class="subtitle">{{ formattedDate }}</p>
        <div v-if="chips.length" class="chips">
          <AppChip v-for="chip in chips" :key="chip">{{ chip }}</AppChip>
        </div>
      </div>
      <component v-if="mediaIcon" :is="mediaIcon" :color="iconColor" class="type-icon"></component>
    </AppCardContent>
  </AppCard>
  </router-link>
</template>

<script lang="ts" setup>
import AppCard from '@/components/common/AppCard.vue';
import AppCardContent from '@/components/common/AppCardContent.vue';
import { computed } from "vue";
import { format, parseISO } from "date-fns";
import AppChip from '@/components/common/AppChip.vue';
import MediaThumbnail from "@/components/MediaThumbnail.vue";
import type { SearchResult } from "@/types/search";
import Film from '~icons/lucide/film';
import Tv from '~icons/lucide/tv';
import User from '~icons/lucide/user';
import Mic from '~icons/lucide/mic';
import { getAvatarFallbackUrl } from '@/utils/image';

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
    case "movie": return Film;
    case "tv": return Tv;
    case "person": return User;
    case "voice_actor": return Mic;
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
  margin: 6px 12px;
  border-radius: 14px;
  background: var(--app-overlay-2);
  border: 1px solid var(--app-overlay-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, background 0.2s ease;
  
  &:active {
    transform: scale(0.98);
    background: var(--app-overlay-5);
  }
}

.type-icon {
  flex-shrink: 0;
  font-size: 18px;
  margin-left: 10px;
  align-self: center;
  opacity: 0.6;
}

.card-content {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.thumbnail {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 24px; /* Circle */
  object-fit: cover;
  background-color: var(--app-color-step-100, #1e1e1e);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 2px 0;
  color: var(--app-color-text-primary, #ffffff);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitle {
  font-size: 12px;
  color: var(--app-color-text-muted, #8e8e8e);
  margin: 0;
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
    padding: 10px 12px;
    gap: 12px;
  }

  .thumbnail {
    width: 48px;
    height: 48px;
  }

  .title {
    font-size: 15px;
  }

  .subtitle {
    font-size: 12px;
  }

  .chips {
    gap: 2px;
  }

}
</style>
