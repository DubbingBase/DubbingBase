<template>
  <ion-header>
    <ion-toolbar>
      <ion-title>Ajouter un projet</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="closeModal">Fermer</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <form @submit.prevent="handleSubmit">
      <ion-list>
        <ion-item>
          <ion-label position="stacked">Titre du média *</ion-label>
          <ion-searchbar
            v-model="formData.media_title"
            placeholder="Rechercher un film ou une série..."
            @ionInput="searchMedia"
          ></ion-searchbar>
        </ion-item>

        <div v-if="searchResults.length > 0" class="search-results">
          <ion-list>
            <ion-item
              v-for="result in searchResults"
              :key="result.id"
              button
              @click="selectMedia(result)"
            >
              <ion-thumbnail slot="start">
                <img
                  v-if="result.poster_path"
                  :src="`https://image.tmdb.org/t/p/w92${result.poster_path}`"
                  :alt="getMediaTitle(result)"
                />
              </ion-thumbnail>
              <ion-label>
                <h3>{{ getMediaTitle(result) }}</h3>
                <p>{{ getMediaYear(result) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </div>

        <div v-if="selectedMedia">
          <ion-item>
            <ion-label position="stacked">Personnage / Acteur Original *</ion-label>
            <ion-searchbar
              v-model="characterSearchQuery"
              placeholder="Rechercher un personnage ou acteur"
              @ionInput="onCharacterSearch"
              :disabled="!cast.length"
            ></ion-searchbar>
          </ion-item>

          <div v-if="characterSearchResults.length > 0" class="search-results">
            <ion-list>
              <ion-item
                v-for="member in characterSearchResults"
                :key="member.id"
                button
                @click="selectCastMember(member)"
              >
                <ion-label>
                  <h3>{{ member.name }}</h3>
                  <p>{{ member.character }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </div>
        </div>

      </ion-list>

      <div class="form-actions">
        <ion-button
          type="submit"
          :disabled="!isFormValid || isSubmitting"
          expand="block"
        >
          <LoadingSpinner v-if="isSubmitting" slot="start" :inline="true"></LoadingSpinner>
          Ajouter le projet
        </ion-button>
      </div>
    </form>
  </ion-content>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { modalController, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonSearchbar, IonThumbnail, IonLabel } from '@ionic/vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useProfileStore } from '@/stores/profile'
import { supabase } from '@/api/supabase'
import type { Movie, CastMember as MovieCastMember } from '../../../supabase/functions/_shared/movie'
import type { Serie, CastMember as SerieCastMember } from '../../../supabase/functions/_shared/serie'

const profileStore = useProfileStore()
const emit = defineEmits<{ (e: 'close'): void }>()

const formData = ref({
  media_title: '',
})

const searchResults = ref<(Movie | Serie)[]>([])
const selectedMedia = ref<(Movie | Serie | any) | null>(null)
const cast = ref<(MovieCastMember | SerieCastMember)[]>([])
const selectedCastId = ref<number | null>(null)
const characterSearchQuery = ref('')
const characterSearchResults = ref<(MovieCastMember | SerieCastMember)[]>([])
const isSubmitting = ref(false)
let searchTimeout: any = null

const isFormValid = computed(() => !!selectedMedia.value && !!selectedCastId.value)

const getMediaTitle = (media: any) => media?.title || media?.name
const getMediaYear = (media: any) => new Date(media?.release_date || media?.first_air_date).getFullYear()

const closeModal = () => modalController.dismiss()

const searchMedia = (event: any) => {
  const query = event.target.value.toLowerCase()
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    if (query.length < 2) {
      searchResults.value = []
      return
    }
    const { data, error } = await supabase.functions.invoke('search', { body: { query } })
    if (error) {
      console.error(error)
      return
    }
    searchResults.value = data.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
  }, 300)
}

const selectMedia = async (media: Movie | Serie | any) => {
  selectedMedia.value = media
  formData.value.media_title = getMediaTitle(media)
  searchResults.value = []
  selectedCastId.value = null
  characterSearchQuery.value = ''
  const { data, error } = await supabase.functions.invoke('get-media-credits', { body: { media_type: media.media_type, media_id: media.id } })
  if (error) {
    console.error(error)
    return
  }
  cast.value = data.cast
  characterSearchResults.value = cast.value.slice(0, 10)
}

const onCharacterSearch = (event: any) => {
  const query = event.target.value
  characterSearchQuery.value = query

  if (selectedCastId.value) {
    const selectedMember = cast.value.find(c => c.id === selectedCastId.value)
    if (selectedMember) {
      const selectedText = `${selectedMember.name} (${selectedMember.character})`
      if (query !== selectedText) {
        selectedCastId.value = null
      }
    }
  }

  const lowerCaseQuery = query.toLowerCase()
  if (lowerCaseQuery.length === 0) {
    characterSearchResults.value = cast.value.slice(0, 10)
    return
  }

  characterSearchResults.value = cast.value.filter(member =>
    member.name.toLowerCase().includes(lowerCaseQuery) ||
    (member.character && member.character.toLowerCase().includes(lowerCaseQuery))
  )
}

const selectCastMember = (member: MovieCastMember | SerieCastMember) => {
  selectedCastId.value = member.id
  characterSearchQuery.value = `${member.name} (${member.character})`
  characterSearchResults.value = []
}

const handleSubmit = async () => {
  if (!isFormValid.value || !selectedMedia.value) return
  isSubmitting.value = true
  try {
    await profileStore.addWorkEntry({
      voice_actor_id: profileStore.voiceActor!.id,
      media_type: selectedMedia.value.media_type,
      media_id: selectedMedia.value.id,
      actor_id: selectedCastId.value,
    }, { voiceActorId: profileStore.voiceActor!.id })
    closeModal()
  } catch (err) {
    console.error(err)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.search-results ion-list { max-height: 200px; overflow-y: auto; }
.form-actions { padding: 1rem; }
</style>
