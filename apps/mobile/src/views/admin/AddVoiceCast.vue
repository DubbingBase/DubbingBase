<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="{ name: 'Home' }" />
        </ion-buttons>
        <ion-title>Add Voice Cast</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <div v-if="loading" class="loading-spinner">
        <LoadingSpinner text="Loading movie data..."></LoadingSpinner>
      </div>

      <div v-else-if="error" class="error-message">
        <p>Error: {{ error }}</p>
        <ion-button @click="fetchMovieData">Retry</ion-button>
      </div>

      <div v-else class="container">
        <!-- Movie Info Section -->
        <div class="movie-header">
          <div class="movie-poster">
            <MediaItem
              :imagePath="movie?.poster_path || null"
              :title="movie?.title || ''"
              :routeName="'MovieDetails'"
              :routeParams="{ id: movie?.id }"
            />
          </div>
          <div class="movie-info">
            <h1>{{ movie.title }}</h1>
            <p v-if="movie.release_date">{{ new Date(movie.release_date).getFullYear() }}</p>
            <p v-if="movie.overview" class="overview">{{ movie.overview }}</p>
          </div>
        </div>

        <!-- Cast List -->
        <div class="cast-section">
          <h2>Cast Members</h2>
          <div v-if="actors.length === 0" class="no-cast">
            No cast members found for this movie.
          </div>
          <div v-else class="cast-list">
            <div v-for="actor in actors" :key="actor.id" class="cast-item">
              <div class="actor-info">
                <MediaItem
                  v-if="actor.profile_path"
                  :imagePath="actor.profile_path"
                  :title="actor.name"
                  :routeName="'ActorDetails'"
                  :routeParams="{ id: actor.id }"
                  class="actor-image"
                />
                <div class="actor-details">
                  <h3>{{ actor.name }}</h3>
                  <p class="character">{{ actor.character }}</p>
                </div>
              </div>
              <div class="voice-actor-select">
                <ion-button expand="block" fill="outline" @click="openVoiceActorModal(actor.id)">
                  <template v-if="getSelectedVoiceActor(actor.id)">
                    {{ getSelectedVoiceActor(actor.id)?.firstname }} {{ getSelectedVoiceActor(actor.id)?.lastname }}
                  </template>
                  <template v-else>
                    Select Voice Actor
                  </template>
                </ion-button>
                <ion-button v-if="voiceActorAssignments[actor.id]" fill="clear" color="medium" @click.stop="clearVoiceActor(actor.id)" title="Clear selection">
                  <ion-icon :icon="closeCircle"></ion-icon>
                </ion-button>
              </div>
            </div>
          </div>
        </div>

        <!-- Save Button -->
        <div class="action-buttons">
          <ion-button
            expand="block"
            :disabled="isSaving || !hasChanges"
            @click="saveVoiceCast"
          >
            <LoadingSpinner v-if="isSaving" name="crescent" :inline="true"></LoadingSpinner>
            <span v-else>Save Changes</span>
          </ion-button>
        </div>
      </div>
      <!-- Voice Actor Search Modal -->
      <ion-modal :is-open="isModalOpen" @didDismiss="closeModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>Select Voice Actor</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeModal">
                <ion-icon :icon="closeCircle"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <ion-searchbar v-model="modalSearchTerm" @ionInput="handleModalSearch" placeholder="Search voice actors..."></ion-searchbar>
          <div v-if="modalLoading" class="loading-spinner">
            <LoadingSpinner text="Searching..."></LoadingSpinner>
          </div>
          <div v-else-if="modalError" class="error-message">
            <p>Error: {{ modalError }}</p>
          </div>
          <ion-list v-else>
            <ion-item v-for="actor in modalResults" :key="actor.id" button @click="selectVoiceActor(actor)">
              <ion-avatar slot="start" v-if="actor.profile_picture">
                <img :src="actor.profile_picture" :alt="actor.firstname + ' ' + actor.lastname" />
              </ion-avatar>
              <ion-label>{{ actor.firstname }} {{ actor.lastname }}</ion-label>
            </ion-item>
            <ion-item v-if="!modalResults.length && !modalLoading">No results found.</ion-item>
          </ion-list>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>


<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useIonRouter } from '@ionic/vue';

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonButtons,
  IonBackButton,
  IonModal,
  IonSearchbar,
  IonList,
  IonAvatar,
  IonIcon,
  toastController
} from '@ionic/vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import MediaItem from '@/components/MediaItem.vue'
import { closeCircle } from 'ionicons/icons';
import { supabase } from '@/api/supabase';

// Types
interface Actor {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  person_id: number;
  person_name: string;
  order: number;
}

interface VoiceActor {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture: string | null;
}

interface WorkAndVoiceActor {
  actor_id: number;
  voice_actor_id: number;
  voice_actor: VoiceActor;
  performance: string;
}

interface MovieResponse {
  movie: {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string;
    external_ids?: {
      wikidata_id?: string;
    };
    credits: {
      cast: Actor[];
    };
    [key: string]: any;
  };
  voiceActors: WorkAndVoiceActor[];
}

// Route and state
const route = useRoute();
const ionRouter = useIonRouter();
const movieId = computed(() => Number(route.params.id));

// State
const movie = ref<MovieResponse['movie'] | null>(null);
const actors = ref<Actor[]>([]);
const voiceActors = ref<WorkAndVoiceActor[]>([]);
const voiceActorAssignments = ref<Record<number, number | null>>({});
const loading = ref(true);
const error = ref<string | null>(null);
const isSaving = ref(false);

// Modal state
const isModalOpen = ref(false);
const modalActorId = ref<number | null>(null);
const modalSearchTerm = ref('');
const modalResults = ref<VoiceActor[]>([]);
const modalLoading = ref(false);
const modalError = ref<string | null>(null);


// Modal logic
function openVoiceActorModal(actorId: number) {
  modalActorId.value = actorId;
  modalSearchTerm.value = '';
  modalResults.value = [];
  modalError.value = null;
  isModalOpen.value = true;
}
function closeModal() {
  isModalOpen.value = false;
  modalActorId.value = null;
  modalSearchTerm.value = '';
  modalResults.value = [];
  modalError.value = null;
}
async function handleModalSearch() {
  const query = modalSearchTerm.value.trim();
  if (!query) {
    modalResults.value = [];
    return;
  }
  modalLoading.value = true;
  modalError.value = null;
  try {
    const { data, error } = await supabase.functions.invoke('search-voice-actors', {
      body: { query, limit: 10 },
    });
    if (error) throw error;
    modalResults.value = data || [];
  } catch (e: any) {
    modalError.value = 'Failed to search voice actors.';
    modalResults.value = [];
  } finally {
    modalLoading.value = false;
  }
}
function selectVoiceActor(actor: VoiceActor) {
  if (modalActorId.value !== null) {
    voiceActorAssignments.value[modalActorId.value] = actor.id;
    closeModal();
  }
}
function getSelectedVoiceActor(actorId: number): VoiceActor | null {
  const vaId = voiceActorAssignments.value[actorId];
  if (!vaId) return null;
  // Try from modalResults first (fresh search), then from existing voiceActors
  return (
    modalResults.value.find(a => a.id === vaId) ||
    voiceActors.value.map(v => v.voice_actor).find(a => a.id === vaId) ||
    null
  );
}
// Debounced search function
const searchVoiceActors = async (query: string) => {
  if (!query.trim()) {
    searchResults.value = [];
    return;
  }

  isSearching.value = true;
  searchError.value = null;

  try {
    const { data, error: searchError } = await supabase.functions.invoke('search-voice-actors', {
      body: { query, limit: 10 },
    });

    if (searchError) throw searchError;
    searchResults.value = data || [];
  } catch (err) {
    console.error('Error searching voice actors:', err);
    searchError.value = 'Failed to search voice actors';
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

// Handle search input
const handleSearch = (event: CustomEvent, actorId: number) => {
  const query = event.detail.value || '';
  searchTerm.value = query;
  dropdownOpen.value = actorId;
  searchVoiceActors(query);
};

// Clear search when dropdown is closed
const onIonCancel = () => {
  searchTerm.value = '';
  searchResults.value = [];
  dropdownOpen.value = null;
};

// Clean up debounce on component unmount
onBeforeUnmount(() => {
  searchVoiceActors.cancel();
});

// Get voice actors for a specific actor ID
const getVoiceActorByActorId = (actorId: number): WorkAndVoiceActor[] => {
  return voiceActors.value.filter(v => v.actor_id === actorId);
};

// Computed
const hasChanges = computed(() => {
  return Object.values(voiceActorAssignments.value).some(assignment => assignment !== null);
});

const fetchMovieData = async () => {
  try {
    loading.value = true;
    error.value = null;

    // Fetch movie data using edge function
    const { data: movieResponse, error: fetchError } = await supabase.functions.invoke('movie', {
      body: { id: movieId.value },
    });

    if (fetchError) throw fetchError;

    // Type assertion to ensure we have the correct shape
    const response = movieResponse as MovieResponse;

    movie.value = response.movie;
    voiceActors.value = response.voiceActors || [];

    // Map actors from the credits
    actors.value = response.movie.credits?.cast || [];

    // Initialize voice actor assignments
    voiceActorAssignments.value = actors.value.reduce((acc, actor) => {
      // Find if there's an existing voice actor for this actor
      const voiceActor = voiceActors.value.find(va => va.actor_id === actor.id);
      acc[actor.id] = voiceActor?.voice_actor_id || null;
      return acc;
    }, {} as Record<number, number | null>);

  } catch (err) {
    console.error('Error fetching movie data:', err);
    error.value = 'Failed to load movie data. Please try again.';
  } finally {
    loading.value = false;
  }
};

// No need for separate fetchVoiceActors and fetchExistingVoiceCast functions
// as they are now handled by the edge function

const onVoiceActorSelected = (actorId: number, event: CustomEvent) => {
  voiceActorAssignments.value[actorId] = event.detail.value;
};

const clearVoiceActor = (actorId: number) => {
  voiceActorAssignments.value[actorId] = null;
};

const saveVoiceCast = async () => {
  if (!hasChanges.value) return;

  try {
    isSaving.value = true;

    // Get all assignments that have a voice actor selected
    const assignments = Object.entries(voiceActorAssignments.value)
      .filter(([_, voiceActorId]) => voiceActorId !== null)
      .map(([actorId, voiceActorId]) => ({
        actor_id: Number(actorId),
        voice_actor_id: voiceActorId,
        content_id: movieId.value,
        content_type: 'movie',
        performance: 'voice'
      }));

    // Delete existing assignments for this movie
    const { error: deleteError } = await supabase
      .from('work')
      .delete()
      .eq('content_id', movieId.value)
      .eq('content_type', 'movie');

    if (deleteError) throw deleteError;

    // Insert new assignments
    if (assignments.length > 0) {
      const { error: insertError } = await supabase
        .from('work')
        .insert(assignments);

      if (insertError) throw insertError;
    }

    await showSuccess('Voice cast saved successfully!');
    ionRouter.push(`/movie/${movieId.value}`);

  } catch (err) {
    console.error('Error saving voice cast:', err);
    showError('Failed to save voice cast');
  } finally {
    isSaving.value = false;
  }
};

const showError = async (message: string) => {
  const toast = await toastController.create({
    message,
    duration: 3000,
    color: 'danger',
    position: 'bottom'
  });
  await toast.present();
};

const showSuccess = async (message: string) => {
  const toast = await toastController.create({
    message,
    duration: 2000,
    color: 'success',
    position: 'bottom'
  });
  await toast.present();
};

// Lifecycle hooks
onMounted(async () => {
  if (!movieId.value) {
    error.value = 'No movie ID provided';
    loading.value = false;
    return;
  }

  await fetchMovieData();
});
</script>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px;
}

.loading-spinner,
.error-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 50vh;
  gap: 16px;
}

.movie-header {
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
  padding: 16px;
  background-color: var(--ion-color-light);
  border-radius: 8px;
}

.movie-poster {
  width: 150px;
  flex-shrink: 0;
}

.movie-poster img {
  width: 100%;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.movie-info {
  flex: 1;
}

.movie-info h1 {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 1.5rem;
  font-weight: 600;
}

.overview {
  margin-top: 12px;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  line-height: 1.4;
}

.cast-section {
  margin-top: 24px;
}

.cast-section h2 {
  font-size: 1.3rem;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.cast-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cast-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background-color: var(--ion-color-light);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.actor-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.actor-image {
  width: 48px;
  height: 72px;
  border-radius: 4px;
  object-fit: cover;
}

.actor-details {
  flex: 1;
}

.actor-details h3 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: 500;
}

.character {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.voice-actor-select {
  margin-top: 8px;
}

.action-buttons {
  margin: 32px 0;
  padding: 0 16px;
}

.no-cast {
  text-align: center;
  padding: 24px;
  color: var(--ion-color-medium);
  font-style: italic;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .movie-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .movie-poster {
    width: 120px;
  }

  .actor-info {
    flex-direction: column;
    text-align: center;
  }

  .actor-image {
    width: 80px;
    height: 120px;
  }
}
</style>
