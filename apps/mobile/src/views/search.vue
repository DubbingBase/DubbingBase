<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Search</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          v-model="query"
          :debounce="300"
          @ionInput="search($event)"
          show-clear-button="always"
        ></ion-searchbar>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="content-wrapper">
        <transition-group name="fade" tag="div">
          <ion-list v-if="matches.length > 0">
            <SearchResultItem
              v-for="match in matches"
              :key="match.id"
              :match="match"
            />
          </ion-list>
        </transition-group>
        <p v-if="!isLoading && matches.length === 0 && trimmedQuery.length >= 3" class="empty-state">No results found</p>
        <p v-if="!isLoading && matches.length === 0 && trimmedQuery.length < 3" class="empty-state">Start typing to search...</p>
      </div>
      <LoadingSpinner v-if="isLoading" :overlay="true" />
      <ion-toast :is-open="!!error" :message="error" @didDismiss="error=''"></ion-toast>
    </ion-content>
  </ion-page>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import {
  IonHeader,
  IonSearchbar,
  IonTitle,
  IonContent,
  IonList,
  IonToolbar,
  IonPage,
  IonToast,
  SearchbarInputEventDetail,
} from "@ionic/vue";
import { IonSearchbarCustomEvent } from "@ionic/core";
import SearchResultItem from "@/components/SearchResultItem.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { supabase } from '@/api/supabase';

type SearchResult = {
  id: number;
  media_type: "movie" | "tv" | "person" | "voice_actor";
  poster_path?: string;
  profile_path?: string;
  title?: string;
  name?: string;
  firstname?: string;
  lastname?: string;
  release_date?: string;
  first_air_date?: string;
};

const matches = ref<SearchResult[]>([]);
const isLoading = ref(false);
const error = ref('');
const query = ref('');
const trimmedQuery = computed(() => query.value.trim());
let abortController: AbortController | null = null;

const priority = { voice_actor: 1, movie: 2, tv: 3, person: 4,  };

const search = async (
  event: IonSearchbarCustomEvent<SearchbarInputEventDetail>
) => {
  query.value = event.target.value || '';

  if (trimmedQuery.value.length < 2) {
    matches.value = [];
    return;
  }

  // Cancel previous request
  if (abortController) {
    abortController.abort();
  }

  abortController = new AbortController();
  isLoading.value = true;
  error.value = '';

  try {
    const { data, error } = await supabase.functions.invoke('search', {
      body: { query: trimmedQuery.value },
    });

    if (error) throw error;

    matches.value = data || [];
    // matches.value.sort((a, b) => priority[a.media_type] - priority[b.media_type]);
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      error.value = err.message || 'Search failed';
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.empty-state {
  text-align: center;
  padding: 20px;
  color: #666;
}
.content-wrapper {
  position: relative;
}
</style>

