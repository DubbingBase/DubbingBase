<template>
  <section
    class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start"
    :aria-label="$t('projectEditor.voiceCast')"
    data-testid="cast-workspace"
  >
    <div class="min-w-0 space-y-4">
      <!-- Progress: the cast workflow is "assign every role", so surface how far along it is. -->
      <div class="rounded-2xl border theme-border theme-surface-overlay p-4 space-y-2.5">
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-sm font-semibold theme-text" aria-live="polite">
            {{ $t("projectEditor.castProgress", summary) }}
          </p>
          <span class="text-xs tabular-nums theme-text-muted">{{ summary.percent }}%</span>
        </div>
        <div
          class="h-1.5 overflow-hidden rounded-full theme-surface-muted"
          role="progressbar"
          :aria-valuenow="summary.percent"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="$t('projectEditor.castProgress', summary)"
        >
          <div
            class="h-full rounded-full bg-[var(--app-color-success-text)] transition-[width] duration-300"
            :style="{ width: `${summary.percent}%` }"
          />
        </div>
      </div>

      <!-- Toolbar -->
      <div class="flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <SearchIcon
            class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 theme-text-muted"
            aria-hidden="true"
          />
          <input
            v-model="query"
            type="search"
            enterkeyhint="search"
            :aria-label="$t('projectEditor.castSearch')"
            :placeholder="$t('projectEditor.castSearch')"
            class="h-11 w-full rounded-xl border theme-border theme-input pl-10 pr-3 text-base sm:text-sm theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)]"
            data-testid="cast-search"
          />
        </div>
        <button
          type="button"
          class="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold theme-primary-bg hover:bg-[var(--app-color-primary-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
          :aria-label="$t('projectEditor.addVoiceActor')"
          data-testid="add-cast-row"
          @click="addRow"
        >
          <PlusIcon class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t("projectEditor.addVoiceActor") }}</span>
        </button>
      </div>

      <!-- Assignment filter -->
      <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group">
        <button
          v-for="chip in filters"
          :key="chip.id"
          type="button"
          class="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
          :class="
            filter === chip.id
              ? 'theme-status-info theme-status-info-text border-[var(--app-color-focus)]'
              : 'theme-border theme-surface-overlay theme-text-secondary theme-hover-surface-muted'
          "
          :aria-pressed="filter === chip.id"
          :data-testid="`cast-filter-${chip.id}`"
          @click="filter = chip.id"
        >
          {{ chip.label }}
          <span class="tabular-nums opacity-70">{{ chip.count }}</span>
        </button>
      </div>

      <ul v-if="visibleRows.length > 0" class="space-y-2" data-testid="cast-list">
        <li
          v-for="(row, index) in visibleRows"
          :key="row.key"
          class="[content-visibility:auto] [contain-intrinsic-size:auto_6rem]"
        >
          <button
            type="button"
            class="flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
            :class="
              row.key === selectedKey && isDesktop
                ? 'theme-status-info border-[var(--app-color-focus)]'
                : 'theme-surface-overlay theme-border theme-hover-surface-muted'
            "
            :aria-pressed="row.key === selectedKey"
            :aria-label="
              $t('projectEditor.castSelectRow', {
                index: index + 1,
                label: row.characterName || $t('projectEditor.castUnknownCharacter'),
              })
            "
            data-testid="cast-row"
            @click="selectRow(row.key)"
          >
            <AdminCastAvatar
              :name="row.characterName"
              :src="row.characterImage"
              :title="$t('projectEditor.castCharacter')"
            />
            <span
              class="min-w-0 flex-1 space-y-1.5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0"
            >
              <span class="block min-w-0">
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-sm font-semibold theme-text">
                    {{ row.characterName || $t("projectEditor.castUnknownCharacter") }}
                  </span>
                  <StarIcon
                    v-if="row.highlight"
                    class="h-3.5 w-3.5 shrink-0 fill-current text-[var(--app-color-rating)]"
                    aria-hidden="true"
                  />
                </span>
                <span class="block truncate text-xs theme-text-muted">
                  {{ row.originalActorName || $t("projectEditor.castOriginalActor") }}
                </span>
              </span>
              <span
                v-if="row.assigned"
                class="flex min-w-0 max-w-full items-center gap-2 rounded-full border theme-border theme-surface-muted py-0.5 pl-0.5 pr-3 sm:max-w-[45%]"
              >
                <AdminCastAvatar
                  :name="row.voiceActorName"
                  :src="row.voiceActorImage"
                  class="!h-6 !w-6 !text-[10px]"
                />
                <span class="truncate text-xs font-semibold theme-text-secondary">
                  {{ row.voiceActorName }}
                </span>
              </span>
              <span
                v-else
                class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-[var(--app-color-warning-border)] px-3 py-1 text-xs font-semibold text-[var(--app-color-warning-text)]"
              >
                <PlusIcon class="h-3 w-3 shrink-0" aria-hidden="true" />
                <span class="truncate">{{ $t("projectEditor.castAssignPrompt") }}</span>
              </span>
            </span>
            <ChevronRightIcon class="mt-3 h-4 w-4 shrink-0 theme-text-muted" aria-hidden="true" />
          </button>
        </li>
      </ul>

      <div
        v-else
        class="space-y-3 rounded-2xl border border-dashed theme-border theme-input py-10 text-center text-sm theme-text-muted"
        data-testid="cast-empty"
      >
        <p v-if="rows.length === 0">{{ $t("projectEditor.noCastMembers") }}</p>
        <template v-else>
          <p>
            {{
              query.trim()
                ? $t("projectEditor.castNoMatch", { query })
                : $t("projectEditor.castEmptyFilter")
            }}
          </p>
          <button
            type="button"
            class="min-h-11 px-4 text-xs font-semibold theme-status-info-text hover:underline"
            @click="resetFilters"
          >
            {{ $t("projectEditor.castClearSearch") }}
          </button>
        </template>
      </div>

      <!-- Adding at the end of a long roster should not require scrolling back up. -->
      <button
        v-if="rows.length > 0"
        type="button"
        class="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed theme-border text-sm font-semibold theme-text-secondary theme-hover-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
        data-testid="add-cast-row-end"
        @click="addRow"
      >
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        {{ $t("projectEditor.addVoiceActor").replace(/^\+\s*/, "") }}
      </button>

      <!-- Mobile shortcut that follows the scroll, parked above the sticky save bar. -->
      <button
        type="button"
        class="fixed right-4 bottom-[calc(6rem+var(--keyboard-inset,0px))] z-[35] inline-flex h-14 w-14 items-center justify-center rounded-full theme-primary-bg shadow-xl lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
        :aria-label="$t('projectEditor.addVoiceActor')"
        data-testid="add-cast-row-fab"
        @click="addRow"
      >
        <PlusIcon class="h-6 w-6" aria-hidden="true" />
      </button>
    </div>

    <ClientOnly>
      <!-- Desktop: persistent detail panel next to the list -->
      <aside
        v-if="isDesktop"
        class="sticky top-[84px] max-h-[calc(100dvh-6.5rem)] overflow-y-auto rounded-2xl border theme-border theme-surface-overlay p-5"
        :aria-label="$t('projectEditor.castDetails')"
        data-testid="cast-detail"
      >
        <div v-if="selectedRow" :key="selectedRow.key" class="space-y-5">
          <AdminCastRoleSummary :row="selectedRow" />
          <slot name="detail" :row-key="selectedRow.key" />
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--app-color-danger-text)] hover:bg-[var(--app-color-danger-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
            :aria-label="removeLabel"
            data-testid="remove-cast-row"
            @click="emit('remove', selectedRow.key)"
          >
            <Trash2Icon class="h-4 w-4" aria-hidden="true" />
            {{ $t("projectEditor.castRemoveRole") }}
          </button>
        </div>
        <p v-else class="py-10 text-center text-sm theme-text-muted">
          {{ $t("projectEditor.castSelectPrompt") }}
        </p>
      </aside>

      <!-- Mobile: bottom sheet that rides above the on-screen keyboard -->
      <DialogRoot v-else :open="sheetOpen && selectedRow !== null" @update:open="onSheetOpen">
        <DialogPortal>
          <DialogOverlay class="cast-sheet-overlay fixed inset-0 z-[90] bg-black/55" />
          <DialogContent
            class="cast-sheet fixed inset-x-0 bottom-[var(--keyboard-inset,0px)] z-[91] flex max-h-[calc(100dvh-var(--keyboard-inset,0px)-1rem)] flex-col rounded-t-3xl border-x border-t theme-border theme-surface shadow-2xl outline-none"
            data-testid="cast-detail"
            @open-auto-focus.prevent
          >
            <div class="flex justify-center pt-2.5" aria-hidden="true">
              <span class="h-1 w-10 rounded-full theme-surface-muted" />
            </div>
            <div class="flex items-start justify-between gap-3 px-4 pb-3 pt-2">
              <DialogTitle class="sr-only">{{ $t("projectEditor.castDetails") }}</DialogTitle>
              <DialogDescription class="sr-only">
                {{ selectedRow?.characterName || $t("projectEditor.castUnknownCharacter") }}
              </DialogDescription>
              <div class="min-w-0 flex-1">
                <AdminCastRoleSummary v-if="selectedRow" :row="selectedRow" />
              </div>
              <DialogClose
                class="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full theme-text-muted theme-hover-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
                :aria-label="$t('projectEditor.castDone')"
              >
                <XIcon class="h-5 w-5" aria-hidden="true" />
              </DialogClose>
            </div>

            <div
              v-if="selectedRow"
              :key="selectedRow.key"
              class="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain border-t theme-border px-4 py-5"
            >
              <slot name="detail" :row-key="selectedRow.key" />
            </div>

            <div
              class="flex items-center gap-2 border-t theme-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <button
                v-if="selectedRow"
                type="button"
                class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border theme-border text-[var(--app-color-danger-text)] hover:bg-[var(--app-color-danger-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
                :aria-label="removeLabel"
                :title="$t('projectEditor.castRemoveRole')"
                data-testid="remove-cast-row"
                @click="emit('remove', selectedRow.key)"
              >
                <Trash2Icon class="h-5 w-5" aria-hidden="true" />
              </button>
              <DialogClose
                class="h-12 flex-1 rounded-xl text-sm font-bold theme-primary-bg hover:bg-[var(--app-color-primary-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
                data-testid="cast-detail-done"
              >
                {{ $t("projectEditor.castDone") }}
              </DialogClose>
            </div>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>
    </ClientOnly>
  </section>
</template>

<script setup lang="ts">
import {
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-vue-next";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { refDebounced, useMediaQuery } from "@vueuse/core";
import { computed, nextTick, ref, watch } from "vue";
import {
  filterCastRows,
  summarizeCast,
  type CastFilter,
  type CastWorkspaceRow,
} from "~/utils/cast-workspace";

const { t } = useI18n();
const props = defineProps<{
  rows: CastWorkspaceRow[];
  selectedKey: string | null;
}>();

const emit = defineEmits<{
  add: [];
  remove: [key: string];
  "update:selectedKey": [key: string | null];
}>();

// lg and up shows the detail beside the list; below it the detail is a bottom sheet.
const isDesktop = useMediaQuery("(min-width: 1024px)");
const sheetOpen = ref(false);
const onSheetOpen = (open: boolean) => {
  sheetOpen.value = open;
};
const selectRow = (key: string) => {
  emit("update:selectedKey", key);
  sheetOpen.value = true;
};
const addRow = async () => {
  resetFilters();
  emit("add");
  await nextTick();
  sheetOpen.value = true;
};

const selectedRow = computed(() => props.rows.find((row) => row.key === props.selectedKey) ?? null);
const removeLabel = computed(() => {
  const index = props.rows.findIndex((row) => row.key === props.selectedKey);
  return t("projectEditor.removeCastRow", { index: index + 1 });
});
watch(selectedRow, (row) => {
  if (row === null) sheetOpen.value = false;
});

const summary = computed(() => summarizeCast(props.rows));

const query = ref("");
const debouncedQuery = refDebounced(query, 150);
const filter = ref<CastFilter>("all");
const filters = computed<{ id: CastFilter; label: string; count: number }[]>(() => [
  { id: "all", label: t("projectEditor.castFilterAll"), count: summary.value.total },
  {
    id: "unassigned",
    label: t("projectEditor.castFilterUnassigned"),
    count: summary.value.unassigned,
  },
  {
    id: "assigned",
    label: t("projectEditor.castFilterAssigned"),
    count: summary.value.assigned,
  },
]);
const visibleRows = computed(() => filterCastRows(props.rows, debouncedQuery.value, filter.value));
const resetFilters = () => {
  query.value = "";
  filter.value = "all";
};
</script>

<style scoped>
@keyframes cast-sheet-in {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
@keyframes cast-sheet-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.cast-sheet[data-state="open"] {
  animation: cast-sheet-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.cast-sheet-overlay[data-state="open"] {
  animation: cast-sheet-fade 180ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .cast-sheet[data-state="open"],
  .cast-sheet-overlay[data-state="open"] {
    animation: none;
  }
}
</style>
