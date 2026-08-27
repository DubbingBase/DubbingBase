<template>
  <div class="voice-actor-works-grouped">
    <div v-if="works.length === 0" class="no-works">
      <p>Aucune œuvre trouvée</p>
    </div>

    <div v-else class="actors-list">
      <div
        v-for="actorGroup in groupedWorks"
        :key="actorGroup.actor.id"
        class="actor-group"
      >
        <div class="actor-header">
          <RouterLink :to="{ name: 'ActorDetails', params: { id: actorGroup.actor.id } }">
            <PersonItem
              :person="actorGroup.actor"
              type="actor"
              :subtitle-override="`${actorGroup.works.length} œuvre${actorGroup.works.length > 1 ? 's' : ''}`"
            />
          </RouterLink>
        </div>

        <div class="works-list">
          <div
            v-for="work in actorGroup.works"
            :key="work.media.id"
            class="work-item"
          >
            <RouterLink :to="{ name: work.work.dubbing_projects?.content_type === 'movie' ? 'MovieDetails' : work.work.dubbing_projects?.content_type === 'video_game' ? 'GameDetails' : 'SerieDetails', params: { id: work.media.id } }">
              <MovieCard
                :media="work.media"
                :character="work.data.character || ''"
                :character-image="work.data.characterImage"
                :media-type="work.work.dubbing_projects?.content_type === 'movie' ? 'movie' : work.work.dubbing_projects?.content_type === 'video_game' ? 'video_game' : 'serie'"
              />
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from 'vue-router';
import MovieCard from "@/components/MovieCard.vue";
import PersonItem, { PersonData } from "@/components/PersonItem.vue";
import type { Movie as MovieModel } from "@supabase/functions/_shared/movie";
import type { Serie as SerieModel } from "@supabase/functions/_shared/serie";
import { Actor } from "@supabase/functions/_shared/types";

type EnhancedWorkItem = {
  media: MovieModel | SerieModel;
  work: { id: number; actor_id: number; dubbing_projects?: { content_id: number; content_type: string | null } };
  data: {
    character: string | undefined;
    characterImage?: string;
    actor: PersonData<Actor>;
  };
  sortDate: string;
};

interface Props {
  works: EnhancedWorkItem[];
}

const props = defineProps<Props>();

// Group works by actor
const groupedWorks = computed(() => {
  const groups = new Map<number, { actor: EnhancedWorkItem['data']['actor'], works: EnhancedWorkItem[] }>();

  props.works.forEach(work => {
    const actorId = work.data.actor.id;
    if (!groups.has(actorId)) {
      groups.set(actorId, {
        actor: work.data.actor,
        works: []
      });
    }
    groups.get(actorId)!.works.push(work);
  });

  // Sort works within each actor group by release date (newest first)
  const result = Array.from(groups.values()).map(group => ({
    ...group,
    works: [...group.works].sort((a, b) => {
      return a.sortDate > b.sortDate ? -1 : 1;
    })
  }));

  // Sort actors by number of works (descending)
  return result.sort((a, b) => b.works.length - a.works.length);
});
</script>

<style scoped lang="scss">
.voice-actor-works-grouped {
  padding: 12px 0;

  h3 {
    margin: 0 0 12px 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--app-color-text-secondary);
  }

  .no-works {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--app-color-text-muted);

    p {
      margin: 0;
      font-size: 0.95rem;
    }
  }

  .actors-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .actor-group {
    background: var(--app-color-step-100);
    border-radius: 12px;
    border: 1px solid var(--app-color-border);
    margin-bottom: 24px;
    overflow: hidden;

    .actor-header {
      padding: 4px 8px;
      background: var(--app-overlay-2);
      border-bottom: 1px solid #2a2a2a;
    }

    .works-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;

      :deep(.movie-card) {
        background: transparent !important;
        padding: 4px 8px;
      }
    }
  }
}

// Remove link underlines and hover styles from anchor tags
:deep(a) {
  text-decoration: none !important;
  color: inherit !important;
}

:deep(a:hover) {
  text-decoration: none !important;
  color: inherit !important;
}
</style>
