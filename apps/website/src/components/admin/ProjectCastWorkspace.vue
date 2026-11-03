<template>
  <section
    class="grid grid-cols-1 lg:grid-cols-5 gap-4"
    :aria-label="$t('projectEditor.voiceCast')"
    data-testid="cast-workspace"
  >
    <div class="lg:col-span-3 space-y-3 min-w-0">
      <div class="flex items-center gap-2">
        <div class="relative flex-1 min-w-0">
          <input
            v-model="query"
            type="search"
            :aria-label="$t('projectEditor.castSearch')"
            :placeholder="$t('projectEditor.castSearch')"
            class="w-full px-4 py-2.5 min-h-11 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-base sm:text-sm"
            data-testid="cast-search"
          />
        </div>
        <button
          type="button"
          class="shrink-0 px-4 py-2.5 min-h-11 theme-primary-bg hover:bg-[var(--app-color-primary-hover)] text-xs font-semibold rounded-xl transition-colors"
          data-testid="add-cast-row"
          @click="addRow"
        >
          {{ $t("projectEditor.addVoiceActor") }}
        </button>
      </div>
      <p class="text-xs theme-text-muted" aria-live="polite">
        {{ $t("projectEditor.castCount", { count: rows.length }) }}
      </p>

      <ul
        v-if="visibleRows.length > 0"
        class="space-y-2 lg:max-h-[32rem] lg:overflow-y-auto lg:pr-1"
        data-testid="cast-list"
      >
        <li
          v-for="(row, index) in visibleRows"
          :key="row.key"
          class="flex items-stretch gap-1 [content-visibility:auto] [contain-intrinsic-size:auto_5.5rem]"
        >
          <button
            type="button"
            class="flex-1 min-w-0 flex sm:grid sm:grid-cols-3 items-center gap-x-3 p-2.5 text-left rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
            :class="
              row.key === selectedKey
                ? 'theme-status-info border-[var(--app-color-focus)]'
                : 'theme-input theme-border theme-hover-surface-muted'
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
            <span class="flex min-w-0 flex-1 sm:flex-none items-center gap-3">
              <AdminCastAvatar
                :name="row.characterName"
                :src="row.characterImage"
                :title="$t('projectEditor.castCharacter')"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold theme-text">
                  {{ row.characterName || $t("projectEditor.castUnknownCharacter") }}
                  <span v-if="row.highlight" aria-hidden="true">★</span>
                </span>
                <!-- Mobile: original actor → voice actor on one muted line -->
                <span class="block truncate text-xs theme-text-muted sm:hidden">
                  {{ row.originalActorName || $t("projectEditor.castOriginalActor") }}
                  →
                  <span class="theme-text-secondary">{{
                    row.voiceActorName || $t("projectEditor.castUnassigned")
                  }}</span>
                </span>
              </span>
            </span>
            <span class="hidden sm:flex min-w-0 items-center gap-2">
              <AdminCastAvatar :name="row.originalActorName" :src="row.originalActorImage" />
              <span class="min-w-0 truncate text-xs theme-text-muted">
                {{ row.originalActorName || $t("projectEditor.castOriginalActor") }}
              </span>
            </span>
            <span class="hidden sm:flex min-w-0 items-center gap-2">
              <AdminCastAvatar :name="row.voiceActorName" :src="row.voiceActorImage" />
              <span class="min-w-0 truncate text-xs theme-text-secondary">
                {{ row.voiceActorName || $t("projectEditor.castUnassigned") }}
              </span>
            </span>
          </button>
          <button
            type="button"
            class="shrink-0 min-h-11 min-w-11 self-center inline-flex items-center justify-center rounded-xl border theme-status-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
            :aria-label="$t('projectEditor.removeCastRow', { index: index + 1 })"
            :title="$t('projectEditor.removeCastRow', { index: index + 1 })"
            data-testid="remove-cast-row"
            @click="emit('remove', row.key)"
          >
            <XIcon class="w-4 h-4" aria-hidden="true" />
          </button>
        </li>
      </ul>

      <div
        v-else
        class="text-center py-10 theme-input border border-dashed theme-border rounded-xl theme-text-muted text-sm space-y-3"
        data-testid="cast-empty"
      >
        <template v-if="rows.length === 0">
          <p>{{ $t("projectEditor.noCastMembers") }}</p>
        </template>
        <template v-else>
          <p>{{ $t("projectEditor.castNoMatch", { query }) }}</p>
          <button
            type="button"
            class="text-xs font-semibold theme-status-info-text hover:underline"
            @click="query = ''"
          >
            {{ $t("projectEditor.castClearSearch") }}
          </button>
        </template>
      </div>
    </div>

    <aside
      :class="
        isMobile
          ? sheetOpen
            ? 'fixed inset-0 z-50 overflow-y-auto overscroll-contain theme-surface flex flex-col'
            : 'hidden'
          : 'lg:col-span-2 theme-surface-overlay border theme-border rounded-2xl p-4 space-y-4 h-fit lg:sticky lg:top-4'
      "
      :role="isMobile && sheetOpen ? 'dialog' : undefined"
      :aria-modal="isMobile && sheetOpen ? 'true' : undefined"
      :aria-label="$t('projectEditor.castDetails')"
      ref="detailPanel"
      data-testid="cast-detail"
    >
      <header
        v-if="isMobile"
        class="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b theme-border theme-surface"
      >
        <button
          type="button"
          class="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl theme-hover-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
          :aria-label="$t('projectEditor.castDone')"
          data-testid="cast-detail-back"
          @click="closeSheet"
        >
          <ArrowLeftIcon class="w-5 h-5" aria-hidden="true" />
        </button>
        <h4 class="min-w-0 truncate text-sm font-bold theme-text">
          {{ selectedRow?.characterName || $t("projectEditor.castDetails") }}
        </h4>
      </header>
      <h4 v-else class="text-sm font-bold theme-text uppercase tracking-wider">
        {{ $t("projectEditor.castDetails") }}
      </h4>
      <div :class="isMobile ? 'flex-1 p-4 space-y-4' : 'space-y-4'">
        <div
          v-if="selectedRow"
          class="flex items-start justify-between gap-2 text-center"
          data-testid="cast-detail-portraits"
        >
          <figure v-for="item in portraits" :key="item.label" class="min-w-0 flex-1 space-y-1">
            <AdminCastAvatar :name="item.name" :src="item.image" large class="mx-auto" />
            <figcaption class="truncate text-xs font-semibold theme-text">
              {{ item.name || $t("projectEditor.castUnassigned") }}
            </figcaption>
            <span class="block truncate text-[11px] theme-text-muted">{{ item.label }}</span>
          </figure>
        </div>
        <slot v-if="selectedKey" name="detail" :row-key="selectedKey" />
        <p v-else class="text-sm theme-text-muted">
          {{ $t("projectEditor.castSelectPrompt") }}
        </p>
      </div>
      <!-- Stays above the on-screen keyboard; bottom padding lets the last field scroll clear of it. -->
      <div
        v-if="isMobile"
        class="sticky bottom-[var(--keyboard-inset,0px)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t theme-border theme-surface"
      >
        <button
          type="button"
          class="w-full min-h-12 rounded-xl theme-primary-bg text-sm font-bold"
          data-testid="cast-detail-done"
          @click="closeSheet"
        >
          {{ $t("projectEditor.castDone") }}
        </button>
      </div>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { ArrowLeftIcon, XIcon } from "lucide-vue-next";
import { refDebounced, useMediaQuery } from "@vueuse/core";
import { computed, nextTick, ref, watch } from "vue";
import { filterCastRows, type CastWorkspaceRow } from "~/utils/cast-workspace";

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

const detailPanel = ref<HTMLElement | null>(null);
// Below lg the detail panel is a full-screen sheet so the keyboard never hides the fields.
const isMobile = useMediaQuery("(max-width: 1023px)");
const sheetOpen = ref(false);
const closeSheet = () => {
  sheetOpen.value = false;
};
const selectRow = (key: string) => {
  emit("update:selectedKey", key);
  sheetOpen.value = true;
};
const addRow = async () => {
  emit("add");
  await nextTick();
  sheetOpen.value = true;
};

watch(
  () => props.selectedKey,
  (key) => {
    if (key === null) sheetOpen.value = false;
  },
);

const selectedRow = computed(() => props.rows.find((row) => row.key === props.selectedKey) ?? null);
const portraits = computed(() =>
  selectedRow.value
    ? [
        {
          label: t("projectEditor.castCharacter"),
          name: selectedRow.value.characterName,
          image: selectedRow.value.characterImage,
        },
        {
          label: t("projectEditor.castOriginalActor"),
          name: selectedRow.value.originalActorName,
          image: selectedRow.value.originalActorImage,
        },
        {
          label: t("projectEditor.voiceActor"),
          name: selectedRow.value.voiceActorName,
          image: selectedRow.value.voiceActorImage,
        },
      ]
    : [],
);

const query = ref("");
const debouncedQuery = refDebounced(query, 150);
const visibleRows = computed(() => filterCastRows(props.rows, debouncedQuery.value));
</script>
