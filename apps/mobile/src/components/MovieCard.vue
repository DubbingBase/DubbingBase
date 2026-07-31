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

    <div v-if="characterImage" class="character-right">
      <MediaThumbnail :path="characterImage" :radius="'8px'" :width="45" :height="60" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MediaThumbnail from "@/components/MediaThumbnail.vue";
import type { Movie as MovieModel } from "@supabase/functions/_shared/movie";
import type { Serie as SerieModel } from "@supabase/functions/_shared/serie";

type Props = {
  media: MovieModel | SerieModel;
  character: string;
  characterImage?: string;
  mediaType: "movie" | "serie";
};

const props = defineProps<Props>();

const title = computed(() => {
  if ("title" in props.media) {
    return (props.media as MovieModel).title;
  }
  return (props.media as SerieModel).name;
});

const releaseDate = computed(() => {
  const date =
    "release_date" in props.media
      ? (props.media as MovieModel).release_date
      : ('first_air_date' in props.media ? props.media.first_air_date : undefined);
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
  background: var(--app-color-card);

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
      color: var(--app-color-text-primary);

      .title-link {
        color: var(--app-color-text-secondary);
        text-decoration: none;
        transition: color 0.2s ease;

        &:hover {
          color: var(--app-color-text-muted);
          text-decoration: underline;
        }
      }
    }

    .character-info,
    .release-date {
      font-size: 0.85rem;

      .character-name {
        color: var(--app-color-text-secondary);
        font-style: italic;
      }

      .date-value {
        color: var(--app-color-text-secondary);
      }
    }
  }

  .character-right {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    flex-shrink: 0;
    margin-left: auto;
    text-align: center;
    max-width: 80px;

    .character-name {
      font-size: 0.75rem;
      color: var(--app-color-text-secondary);
      font-style: italic;
      line-height: 1.1;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
}
</style>
