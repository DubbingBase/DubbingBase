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
              :key="`${match.media_type}:${match.id}`"
              :match="match"
            />
          </ion-list>
        </transition-group>
        <p v-if="!isLoading && matches.length === 0 && trimmedQuery.length >= 2" class="empty-state">No results found</p>
        <p v-if="!isLoading && matches.length === 0 && trimmedQuery.length < 2" class="empty-state">Start typing to search...</p>
      </div>
      <LoadingSpinner v-if="isLoading" :overlay="true" />
      <ion-toast :is-open="!!errorMessage" :message="errorMessage" @didDismiss="errorMessage=''"></ion-toast>
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
import type { SearchResult } from "@/types/search";

const matches = ref<SearchResult[]>([]);
const isLoading = ref(false);
// Renamed to avoid shadowing the destructured `error` from supabase calls
const errorMessage = ref('');
const query = ref('');
const trimmedQuery = computed(() => query.value.trim());
let abortController: AbortController | null = null;

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
  errorMessage.value = '';

  try {
    const { data, error: supaError } = await supabase.functions.invoke('search', {
      body: { query: trimmedQuery.value },
      signal: abortController.signal,
    });

    if (supaError) throw supaError;

    matches.value = data || [];
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      errorMessage.value = err?.message || 'Search failed';
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
