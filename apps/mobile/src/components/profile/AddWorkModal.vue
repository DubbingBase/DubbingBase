<template>
  <AppHeader>
    <AppToolbar>
      <AppTitle>Ajouter un projet</AppTitle>
      <template #end >
        <AppButton @click="closeModal">Fermer</AppButton>
      </template>
    </AppToolbar>
  </AppHeader>

  <AppContent>
    <form @submit.prevent="handleSubmit">
      <AppList>
        <AppListItem>
          <AppText position="stacked">Titre du média *</AppText>
          <AppSearchbar
            v-model="formData.media_title"
            placeholder="Rechercher un film ou une série..."
            @ionInput="searchMedia"
          ></AppSearchbar>
        </AppListItem>

        <div v-if="searchResults.length > 0" class="search-results">
          <AppList>
            <AppListItem
              v-for="result in searchResults"
              :key="result.id"
              button
              @click="selectMedia(result)"
            >
              <AppImage class="app-thumbnail" slot="start">
                <img
                  v-if="result.poster_path"
                  :src="result.poster_path"
                  :alt="getMediaTitle(result)"
                />
              </AppImage>
              <AppText>
                <h3>{{ getMediaTitle(result) }}</h3>
                <p>{{ getMediaYear(result) }}</p>
              </AppText>
            </AppListItem>
          </AppList>
        </div>

        <div v-if="selectedMedia">
          <AppListItem>
            <AppText position="stacked">Personnage / Acteur Original *</AppText>
            <AppSearchbar
              v-model="characterSearchQuery"
              placeholder="Rechercher un personnage ou acteur"
              @ionInput="onCharacterSearch"
              :disabled="!cast.length"
            ></AppSearchbar>
          </AppListItem>

          <div v-if="characterSearchResults.length > 0" class="search-results">
            <AppList>
              <AppListItem
                v-for="member in characterSearchResults"
                :key="member.id"
                button
                @click="selectCastMember(member)"
              >
                <AppText>
                  <h3>{{ member.name }}</h3>
                  <p>{{ member.character }}</p>
                </AppText>
              </AppListItem>
            </AppList>
          </div>
        </div>

      </AppList>

      <div class="form-actions">
        <AppButton
          type="submit"
          :disabled="!isFormValid || isSubmitting"
          expand="block"
        >
          <LoadingSpinner v-if="isSubmitting" slot="start" :inline="true"></LoadingSpinner>
          Ajouter le projet
        </AppButton>
      </div>
    </form>
  </AppContent>
</template>

<script setup lang="ts">
import AppHeader from '@/components/common/layout/AppHeader.vue';
import AppToolbar from '@/components/common/layout/AppToolbar.vue';
import AppTitle from '@/components/common/layout/AppTitle.vue';
import AppContent from '@/components/common/layout/AppContent.vue';
import AppList from '@/components/common/AppList.vue';
import AppListItem from '@/components/common/AppListItem.vue';
import AppButton from '@/components/common/AppButton.vue';
import AppSearchbar from '@/components/common/AppSearchbar.vue';
import AppImage from '@/components/common/AppImage.vue';
import AppText from '@/components/common/AppText.vue';
import AppSpinner from '@/components/common/AppSpinner.vue';
import AppSkeleton from '@/components/common/AppSkeleton.vue';
import { ref, computed } from 'vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useProfileStore } from '@/stores/profile'
import { supabase } from '@/api/supabase'
import type { Movie } from '@supabase/functions/_shared/movie'
import type { Serie } from '@supabase/functions/_shared/serie'
import type { Cast } from '@supabase/functions/_shared/types'
type MovieCastMember = Cast;
type SerieCastMember = Cast;

const profileStore = useProfileStore()
const emit = defineEmits<{ (e: 'close'): void }>()

const formData = ref({
  media_title: ''})

const searchResults = ref<(Movie | Serie)[]>([])
const selectedMedia = ref<(Movie | Serie) | null>(null)
const cast = ref<(MovieCastMember | SerieCastMember)[]>([])
const selectedCastId = ref<number | null>(null)
const characterSearchQuery = ref('')
const characterSearchResults = ref<(MovieCastMember | SerieCastMember)[]>([])
const isSubmitting = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const isFormValid = computed(() => !!selectedMedia.value && !!selectedCastId.value)

const getMediaTitle = (media: Movie | Serie) => ('title' in media) ? media.title : media.name
const getMediaYear = (media: Movie | Serie) => {
  const dateStr = 'release_date' in media ? media.release_date : ('first_air_date' in media ? media.first_air_date : undefined)
  return new Date(dateStr || '').getFullYear()
}

const closeModal = () => emit('close');

const searchMedia = (event: { target: { value: string } }) => {
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
    searchResults.value = data.filter((r: Movie | Serie) => r.media_type === 'movie' || r.media_type === 'tv')
  }, 300)
}

const selectMedia = async (media: Movie | Serie) => {
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

const onCharacterSearch = (event: { target: { value: string } }) => {
  const query = event.target.value
  characterSearchQuery.value = query

  if (selectedCastId.value) {
    const selectedMember = cast.value.find((c: Cast) => c.id === selectedCastId.value)
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

  characterSearchResults.value = cast.value.filter((member: Cast) =>
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
      media_type: selectedMedia.value.media_type === 'tv' ? 'serie' : 'movie',
      media_id: selectedMedia.value.id,
      actor_id: selectedCastId.value}, { voiceActorId: profileStore.voiceActor!.id })
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
