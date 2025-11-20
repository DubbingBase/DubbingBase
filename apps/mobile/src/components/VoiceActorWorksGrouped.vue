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
            <RouterLink :to="{ name: work.media.media_type === 'movie' ? 'MovieDetails' : 'SerieDetails', params: { id: work.media.id } }">
              <MovieCard
                :media="work.media"
                :character="work.data.character || ''"
                :media-type="work.media.media_type === 'movie' ? 'movie' : 'serie'"
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
import { RouterLink } from "vue-router";
import MovieCard from "@/components/MovieCard.vue";
import PersonItem, { PersonData } from "@/components/PersonItem.vue";
import type { Movie as MovieModel } from "../../supabase/functions/_shared/movie";
import type { Serie as SerieModel } from "../../supabase/functions/_shared/serie";
import { Actor } from "../../supabase/functions/_shared/types";

type EnhancedWorkItem = {
  media: MovieModel | SerieModel;
  work: { id: number; actor_id: number; content_id: number };
  data: {
    character: string | undefined;
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
  padding: 12px;
  background: var(--ion-color-card);
  border-radius: 8px;
  border: 1px solid var(--ion-color-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

  h3 {
    margin: 0 0 12px 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--ion-color-text-secondary);
  }

  .no-works {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--ion-color-text-muted);

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
    background: var(--ion-color-surface);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    border: 1px solid var(--ion-color-border);

    .actor-header {
      padding: 8px;
      background: var(--ion-color-surface);
      border-bottom: 1px solid var(--ion-color-border);
    }

    .works-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;

      .work-item {
        /* MovieCard component handles its own styling */
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
