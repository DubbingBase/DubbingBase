<template>
  <div class="movie-card">
    <div class="media-poster">
      <MediaThumbnail :path="media.poster_path" :radius="'8px'" />
    </div>

    <div class="movie-info">
      <h5 class="media-title">
        {{ title }}
      </h5>

      <div class="character-info">
        <span class="character-name">{{ character }}</span>
      </div>

      <div class="release-date">
        <span class="date-value">
          {{ releaseDate }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MediaThumbnail from "@/components/MediaThumbnail.vue";
import type { Movie as MovieModel } from "../../supabase/functions/_shared/movie";
import type { Serie as SerieModel } from "../../supabase/functions/_shared/serie";

type Props = {
  media: MovieModel | SerieModel;
  character: string;
  mediaType: "movie" | "serie";
};

const props = defineProps<Props>();

const title = computed(() => {
  return (props.media as any).title ?? (props.media as any).name;
});

const releaseDate = computed(() => {
  const date =
    (props.media as any).release_date || (props.media as any).first_air_date;
  return date
    ? new Date(date).toLocaleDateString(navigator.language, { year: "numeric" })
    : "";
});
</script>

<style scoped lang="scss">
.movie-card {
  display: flex;
  gap: 12px;
  padding: 8px;
  background: var(--ion-color-card);

  @media (max-width: 768px) {
    flex-direction: row;
    align-items: center;
  }

  .media-poster {
    flex-shrink: 0;
  }

  .movie-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .media-title {
      margin: 0 0 6px 0;
      font-size: 0.95rem;
      font-weight: 600;

      .title-link {
        color: var(--ion-color-text-secondary);
        text-decoration: none;
        transition: color 0.2s ease;

        &:hover {
          color: var(--ion-color-text-muted);
          text-decoration: underline;
        }
      }
    }

    .character-info,
    .release-date {
      font-size: 0.85rem;

      .character-name {
        color: var(--ion-color-text-secondary);
        font-style: italic;
      }

      .date-value {
        color: var(--ion-color-text-secondary);
      }
    }
  }
}
</style>
