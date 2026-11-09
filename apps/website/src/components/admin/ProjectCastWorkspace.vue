<template>
  <section class="min-w-0" :aria-label="$t('projectEditor.voiceCast')" data-testid="cast-workspace">
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
          <span class="hidden sm:inline">{{ addLabel }}</span>
        </button>
      </div>

      <!-- Assignment filter -->
      <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group">
        <AppFilterChip
          v-for="chip in filters"
          :key="chip.id"
          :selected="filter === chip.id"
          :data-testid="`cast-filter-${chip.id}`"
          @click="filter = chip.id"
        >
          {{ chip.label }}
          <span class="tabular-nums opacity-70">{{ chip.count }}</span>
        </AppFilterChip>
      </div>

      <ul v-if="visibleRows.length > 0" class="space-y-2.5" data-testid="cast-list">
        <li
          v-for="(row, index) in visibleRows"
          :id="rowDomId(row.key)"
          :key="row.key"
          class="scroll-mt-36 scroll-mb-32 overflow-hidden rounded-2xl border transition-colors theme-surface-overlay"
          :class="
            row.key === selectedKey
              ? 'border-[var(--app-color-focus)]'
              : 'theme-border [content-visibility:auto] [contain-intrinsic-size:auto_9rem]'
          "
        >
          <!-- Collapsed summary: all three identities stay visible, labelled, in every state. -->
          <button
            :id="`${rowDomId(row.key)}-header`"
            type="button"
            class="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left transition-colors theme-hover-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-color-focus)] sm:gap-4 sm:p-4"
            :aria-expanded="row.key === selectedKey"
            :aria-controls="row.key === selectedKey ? `${rowDomId(row.key)}-panel` : undefined"
            data-testid="cast-row"
            @click="toggleRow(row.key)"
          >
            <AdminCastAvatar
              size="portrait"
              :name="row.characterName"
              :src="row.characterImage"
              :title="$t('projectEditor.castCharacter')"
              data-testid="cast-image-character"
              @error="emit('characterImageError', row.key)"
            />
            <span
              class="grid min-w-0 gap-2.5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-5"
            >
              <span class="block min-w-0">
                <span
                  class="block text-[11px] font-medium uppercase tracking-wide theme-text-muted"
                >
                  {{ $t("projectEditor.castCharacter") }}
                </span>
                <span class="flex items-start gap-1.5">
                  <span
                    class="line-clamp-2 break-words text-base font-bold leading-snug theme-text"
                  >
                    {{ row.characterName || $t("projectEditor.castUnknownCharacter") }}
                  </span>
                  <StarIcon
                    v-if="row.highlight"
                    class="mt-1 h-3.5 w-3.5 shrink-0 fill-current text-[var(--app-color-rating)]"
                    aria-hidden="true"
                  />
                </span>
              </span>
              <span class="flex min-w-0 items-center gap-2.5">
                <AdminCastAvatar
                  size="md"
                  :name="row.originalActorName"
                  :src="row.originalActorImage"
                  data-testid="cast-image-original-actor"
                />
                <span class="block min-w-0">
                  <span
                    class="block text-[11px] font-medium uppercase tracking-wide theme-text-muted"
                  >
                    {{ $t("projectEditor.castOriginalActor") }}
                  </span>
                  <span class="line-clamp-2 break-words text-sm theme-text-secondary">
                    {{ row.originalActorName || "—" }}
                  </span>
                </span>
              </span>
              <span class="flex min-w-0 items-center gap-2.5">
                <AdminCastAvatar
                  size="md"
                  :name="row.voiceActorName"
                  :src="row.voiceActorImage"
                  data-testid="cast-image-voice-actor"
                  :class="row.assigned ? '' : '!border-dashed'"
                />
                <span class="block min-w-0">
                  <span
                    class="block text-[11px] font-medium uppercase tracking-wide theme-text-muted"
                  >
                    {{ $t("projectEditor.castVoiceActor") }}
                  </span>
                  <span
                    v-if="row.assigned"
                    class="line-clamp-2 break-words text-sm font-semibold theme-text"
                  >
                    {{ row.voiceActorName }}
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 text-sm font-semibold theme-status-warning-text"
                  >
                    <PlusIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {{ $t("projectEditor.castAssignPrompt") }}
                  </span>
                </span>
              </span>
            </span>
            <ChevronDownIcon
              class="h-5 w-5 shrink-0 theme-text-muted transition-transform"
              :class="row.key === selectedKey ? 'rotate-180' : ''"
              aria-hidden="true"
            />
          </button>

          <!-- Inline editor: only the open row mounts it, edits live in the parent form state. -->
          <div
            v-if="row.key === selectedKey"
            :id="`${rowDomId(row.key)}-panel`"
            role="region"
            :aria-labelledby="`${rowDomId(row.key)}-header`"
            class="space-y-5 border-t theme-border p-3 sm:p-5 [&_button]:scroll-mb-32 [&_input]:scroll-mb-32"
            data-testid="cast-detail"
          >
            <slot name="detail" :row-key="row.key" />
            <div class="flex justify-end border-t theme-border pt-3">
              <button
                type="button"
                class="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--app-color-danger-text)] hover:bg-[var(--app-color-danger-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
                :aria-label="removeLabel"
                data-testid="remove-cast-row"
                @click="
                  focusNeighbour(row.key);
                  emit('remove', row.key);
                "
              >
                <Trash2Icon class="h-4 w-4" aria-hidden="true" />
                {{ $t("projectEditor.castRemoveRole") }}
              </button>
            </div>
          </div>
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
        {{ addLabel }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ChevronDownIcon, PlusIcon, SearchIcon, StarIcon, Trash2Icon } from "lucide-vue-next";
import { refDebounced } from "@vueuse/core";
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
  /** The character image of this row failed to load; let the resolver try the next source. */
  characterImageError: [key: string];
  "update:selectedKey": [key: string | null];
}>();

const rowDomId = (key: string) => `cast-row-${key}`;

// One row is open at a time. Closing it only hides the editor: edits live in the parent form state.
const toggleRow = (key: string) => {
  emit("update:selectedKey", props.selectedKey === key ? null : key);
};
const addRow = () => {
  resetFilters();
  emit("add");
};

// Keep the opened (or newly added) row in view without moving focus away from its header.
watch(
  () => props.selectedKey,
  async (key) => {
    if (key === null) return;
    await nextTick();
    const element = document.getElementById(rowDomId(key));
    element?.scrollIntoView({ block: "nearest", behavior: "auto" });
  },
);

// Removing the open row destroys the focused button; hand focus to a neighbouring row header.
const focusNeighbour = async (key: string) => {
  const index = visibleRows.value.findIndex((row) => row.key === key);
  const neighbour = visibleRows.value[index + 1] ?? visibleRows.value[index - 1];
  await nextTick();
  if (neighbour) document.getElementById(`${rowDomId(neighbour.key)}-header`)?.focus();
};

const removeLabel = computed(() => {
  const index = props.rows.findIndex((row) => row.key === props.selectedKey);
  return t("projectEditor.removeCastRow", { index: index + 1 });
});

// The translation carries a leading "+" meant for text-only buttons; these have a plus icon.
const addLabel = computed(() => t("projectEditor.addVoiceActor").replace(/^\+\s*/, ""));

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
