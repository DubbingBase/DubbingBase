<template>
  <div class="relative w-full">
    <ComboboxRoot
      :model-value="modelValue"
      @update:model-value="onSelect"
      :ignore-filter="true"
      :open-on-click="true"
      :open-on-focus="true"
      class="w-full relative"
    >
      <ComboboxAnchor class="relative w-full">
        <ComboboxInput
          v-model="searchTerm"
          :display-value="(val) => (val == null ? '' : resolveLabel(val))"
          class="w-full pl-4 pr-16 py-2.5 theme-input border theme-border rounded-xl theme-text placeholder-[#707070] focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm disabled:opacity-50"
          :placeholder="placeholder"
          :aria-label="ariaLabel || placeholder"
          :aria-busy="isLoading"
          :disabled="disabled"
        />
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            v-if="modelValue && !disabled"
            type="button"
            class="p-1 theme-text-muted theme-hover-text transition-colors"
            :aria-label="$t('projectEditor.clearSelection')"
            @click.stop="
              $emit('update:modelValue', null);
              searchTerm = '';
            "
          >
            <XIcon class="w-4 h-4" />
          </button>
          <div v-if="isLoading" class="p-1">
            <Loader2Icon class="w-4 h-4 theme-text-muted animate-spin" />
          </div>
        </div>
      </ComboboxAnchor>

      <ComboboxPortal>
        <ComboboxContent
          class="z-[100] w-[var(--reka-popper-anchor-width)] mt-1 theme-surface border theme-border rounded-xl shadow-xl overflow-hidden"
          position="popper"
        >
          <ComboboxViewport class="max-h-[300px] overflow-y-auto p-1">
            <ComboboxEmpty class="theme-text-muted text-sm py-3 px-4 text-center">
              <span v-if="isLoading">{{ $t("common.searching") }}</span>
              <span v-else-if="searchFailed" class="theme-status-danger-text">{{
                $t("projectEditor.lookupFailed")
              }}</span>
              <span v-else>{{ $t("search.noResults") }}</span>
            </ComboboxEmpty>

            <ComboboxGroup>
              <ComboboxItem
                v-for="option in visibleOptions"
                :key="option.id"
                :value="option.id"
                class="flex items-center px-3 py-2 text-sm theme-text rounded-lg cursor-pointer data-[highlighted]:bg-[var(--app-color-surface-muted)] data-[highlighted]:text-[var(--app-color-text)] outline-none"
              >
                <slot name="option" :option="option">
                  {{ resolveLabel(option.id) }}
                </slot>
              </ComboboxItem>
            </ComboboxGroup>

            <!-- Inline creation option -->
            <div
              v-if="
                allowCreate &&
                searchTerm.length >= 2 &&
                !isLoading &&
                (modelValue == null || searchTerm !== resolveLabel(modelValue))
              "
              class="border-t theme-border mt-1 pt-1"
            >
              <button
                type="button"
                @click="$emit('create', searchTerm)"
                class="w-full text-left px-3 py-2 text-sm theme-text theme-hover-surface-muted rounded-lg font-medium outline-none theme-surface-muted transition-colors flex items-center gap-2"
              >
                <PlusIcon class="w-4 h-4" />
                {{ $t("common.create", { name: searchTerm }) }}
              </button>
            </div>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
  </div>
</template>

<script setup lang="ts" generic="T extends { id: number | string }">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxPortal,
  ComboboxContent,
  ComboboxViewport,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
} from "reka-ui";
import { Loader2Icon, PlusIcon, XIcon } from "lucide-vue-next";
import { useDebounceFn } from "@vueuse/core";

type OptionId = T["id"];

const props = defineProps<{
  modelValue: OptionId | null;
  /**
   * Static options, or initial options before the first `searchFn` result.
   * A new array reference replaces the current results.
   */
  options?: readonly T[];
  loading?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  displayFn: (val: OptionId) => string;
  /**
   * When provided, this instance owns its request, loading, result and error state.
   * Responses that arrive after a newer query are ignored.
   */
  searchFn?: (query: string) => Promise<readonly T[]> | readonly T[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: OptionId | null): void;
  (e: "search", query: string): void;
  (e: "create", query: string): void;
}>();

const searchTerm = ref("");
const ownResults = shallowRef<readonly T[] | null>(null);
const ownLoading = ref(false);
const searchFailed = ref(false);
// Labels seen in this instance's results, kept after the results are replaced.
const seenLabels = new Map<OptionId, string>();
let latestRequest = 0;

const visibleOptions = computed<readonly T[]>(() => ownResults.value ?? props.options ?? []);
const isLoading = computed(() => !!props.loading || ownLoading.value);

const rememberLabels = (options: readonly T[]) => {
  for (const option of options) {
    const label = props.displayFn(option.id);
    if (label) seenLabels.set(option.id, label);
  }
};

const resolveLabel = (val: OptionId): string => props.displayFn(val) || seenLabels.get(val) || "";

watch(
  () => props.options,
  (options) => {
    ownResults.value = null;
    if (options) rememberLabels(options);
  },
  { immediate: true },
);

const onSelect = (val: OptionId | null) => {
  emit("update:modelValue", val);
};

watch(
  () => (props.modelValue == null ? null : resolveLabel(props.modelValue)),
  (label) => {
    searchTerm.value = label ?? "";
  },
  { immediate: true },
);

const runOwnSearch = async (query: string) => {
  const searchFn = props.searchFn;
  if (!searchFn) return;
  const request = ++latestRequest;
  ownLoading.value = true;
  searchFailed.value = false;
  try {
    const results = await searchFn(query);
    if (request !== latestRequest) return;
    rememberLabels(results);
    ownResults.value = results;
  } catch {
    if (request !== latestRequest) return;
    ownResults.value = [];
    searchFailed.value = true;
  } finally {
    if (request === latestRequest) ownLoading.value = false;
  }
};

const debouncedSearch = useDebounceFn((query: string) => {
  // Prevent searching when the input just synced with the selected model value
  if (props.modelValue != null && query === resolveLabel(props.modelValue)) {
    return;
  }
  emit("search", query);
  void runOwnSearch(query);
}, 300);

watch(searchTerm, (newVal) => {
  debouncedSearch(newVal);
});

onBeforeUnmount(() => {
  // Invalidate in-flight requests so they cannot write after unmount.
  latestRequest += 1;
});
</script>
