<template>
  <ion-page>
  <AppPage>
    <AppHeader>
      <AppToolbar style="--background: transparent">
        <AppSearchbar
          ref="searchbarRef"
          v-model="query"
          :debounce="300"
          @ionInput="search($event)"
          placeholder="Movies, actors, shows..."
          class="custom-searchbar"
        ></AppSearchbar>
      </AppToolbar>
    </AppHeader>
    <AppContent>
      <div class="content-wrapper">
        <transition-group name="fade" tag="div">
          <AppList v-if="matches.length > 0">
            <SearchResultItem
              v-for="match in matches"
              :key="`${match.media_type}:${match.id}`"
              :match="match"
            />
          </AppList>
        </transition-group>
        <div
          v-if="!isLoading && matches.length === 0 && trimmedQuery.length >= 2"
          class="empty-state"
        >
          <SearchIcon class="empty-icon" />
          <p class="empty-text">No results found</p>
        </div>
        <div
          v-if="!isLoading && matches.length === 0 && trimmedQuery.length < 2"
          class="empty-state"
        >
          <SearchIcon class="empty-icon" />
          <p class="empty-text">What are you looking for?</p>
        </div>
      </div>
      <LoadingSpinner v-if="isLoading" :overlay="true" />
    </AppContent>
  </AppPage>
  </ion-page>
</template>

<script lang="ts" setup>
import { IonPage, onIonViewDidEnter } from "@ionic/vue";
import AppPage from "@/components/common/layout/AppPage.vue";
import AppHeader from "@/components/common/layout/AppHeader.vue";
import AppToolbar from "@/components/common/layout/AppToolbar.vue";
import AppTitle from "@/components/common/layout/AppTitle.vue";
import AppContent from "@/components/common/layout/AppContent.vue";
import AppList from "@/components/common/AppList.vue";
import AppSearchbar from "@/components/common/AppSearchbar.vue";
import { ref, computed, watch, onUnmounted } from "vue";
import { useToast } from "@/composables/useToast";

defineOptions({ name: "Search" });
import SearchResultItem from "@/components/SearchResultItem.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import SearchIcon from "~icons/lucide/search";
import { supabase } from "@/api/supabase";
import type { SearchResult } from "@/types/search";

const { showToast } = useToast();

const searchbarRef = ref<InstanceType<typeof AppSearchbar> | null>(null);

onIonViewDidEnter(() => {
  searchbarRef.value?.focus();
});

const matches = ref<SearchResult[]>([]);
const isLoading = ref(false);
// Renamed to avoid shadowing the destructured `error` from supabase calls
const errorMessage = ref("");

watch(errorMessage, (newVal) => {
  if (newVal) {
    showToast(newVal, 2000, "danger");
    errorMessage.value = "";
  }
});

const query = ref("");
const trimmedQuery = computed(() => query.value.trim());
let abortController: AbortController | null = null;

const search = async (event: { target: { value: string } }) => {
  query.value = event.target.value || "";

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
  errorMessage.value = "";

  try {
    const { data, error: supaError } = await supabase.functions.invoke(
      "search",
      {
        body: { query: trimmedQuery.value },
        signal: abortController.signal,
      },
    );

    if (supaError) throw supaError;

    matches.value = data || [];
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      errorMessage.value = err?.message || "Search failed";
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--app-color-text-muted, #8e8e8e);
  text-align: center;
  margin-top: 20px;
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}
.empty-text {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
}
.content-wrapper {
  position: relative;
  height: 100%;
}
</style>
