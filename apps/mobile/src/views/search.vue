<template>
  <AppPage>
    <AppHeader>
      <AppToolbar>
        <AppTitle>Search</AppTitle>
      </AppToolbar>
      <AppToolbar style="--background: transparent">
        <AppSearchbar
          v-model="query"
          :debounce="300"
          @ionInput="search($event)"
          show-clear-button="always"
          class="custom-searchbar"
          style="padding: 0 8px"
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
        <p
          v-if="!isLoading && matches.length === 0 && trimmedQuery.length >= 2"
          class="empty-state"
        >
          No results found
        </p>
        <p
          v-if="!isLoading && matches.length === 0 && trimmedQuery.length < 2"
          class="empty-state"
        >
          Start typing to search...
        </p>
      </div>
      <LoadingSpinner v-if="isLoading" :overlay="true" />
    </AppContent>
  </AppPage>
</template>

<script lang="ts" setup>
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
import { supabase } from "@/api/supabase";
import type { SearchResult } from "@/types/search";

const { showToast } = useToast();

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
  transition: opacity 0.5s;
}
.fade-enter-from,
.fade-leave-to {
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
