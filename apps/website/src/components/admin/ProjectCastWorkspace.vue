<template>
  <section
    class="grid grid-cols-1 lg:grid-cols-5 gap-4"
    :aria-label="$t('projectEditor.voiceCast')"
    data-testid="cast-workspace"
  >
    <div class="lg:col-span-3 space-y-3 min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex-1 min-w-48">
          <input
            v-model="query"
            type="search"
            :aria-label="$t('projectEditor.castSearch')"
            :placeholder="$t('projectEditor.castSearch')"
            class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
            data-testid="cast-search"
          />
        </div>
        <button
          type="button"
          class="px-4 py-2.5 min-h-10 theme-primary-bg hover:bg-[var(--app-color-primary-hover)] text-xs font-semibold rounded-xl transition-colors"
          data-testid="add-cast-row"
          @click="emit('add')"
        >
          {{ $t("projectEditor.addVoiceActor") }}
        </button>
      </div>
      <p class="text-xs theme-text-muted" aria-live="polite">
        {{ $t("projectEditor.castCount", { count: rows.length }) }}
      </p>

      <ul
        v-if="visibleRows.length > 0"
        class="max-h-[32rem] overflow-y-auto space-y-2 pr-1"
        data-testid="cast-list"
      >
        <li
          v-for="(row, index) in visibleRows"
          :key="row.key"
          class="flex items-stretch gap-1 [content-visibility:auto] [contain-intrinsic-size:auto_4.5rem]"
        >
          <button
            type="button"
            class="flex-1 min-w-0 flex items-center gap-3 p-2 text-left rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
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
            @click="emit('update:selectedKey', row.key)"
          >
            <span
              class="relative flex shrink-0 items-center"
              :title="row.originalActorName || $t('projectEditor.castOriginalActor')"
            >
              <AdminCastAvatar :name="row.originalActorName" :src="row.originalActorImage" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold theme-text">
                {{ row.characterName || $t("projectEditor.castUnknownCharacter") }}
                <span v-if="row.highlight" aria-hidden="true">★</span>
              </span>
              <span class="block truncate text-xs theme-text-muted">
                {{ row.originalActorName || $t("projectEditor.castOriginalActor") }}
              </span>
            </span>
            <span class="flex min-w-0 max-w-[40%] items-center gap-2">
              <AdminCastAvatar :name="row.voiceActorName" :src="row.voiceActorImage" />
              <span class="truncate text-xs theme-text-secondary">
                {{ row.voiceActorName || $t("projectEditor.castUnassigned") }}
              </span>
            </span>
          </button>
          <button
            type="button"
            class="shrink-0 min-h-10 min-w-10 inline-flex items-center justify-center rounded-xl border theme-status-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
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
      class="lg:col-span-2 theme-surface-overlay border theme-border rounded-2xl p-4 space-y-4 h-fit lg:sticky lg:top-4"
      :aria-label="$t('projectEditor.castDetails')"
      data-testid="cast-detail"
    >
      <h4 class="text-sm font-bold theme-text uppercase tracking-wider">
        {{ $t("projectEditor.castDetails") }}
      </h4>
      <slot v-if="selectedKey" name="detail" :row-key="selectedKey" />
      <p v-else class="text-sm theme-text-muted">
        {{ $t("projectEditor.castSelectPrompt") }}
      </p>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { XIcon } from "lucide-vue-next";
import { refDebounced } from "@vueuse/core";
import { computed, ref } from "vue";
import { filterCastRows, type CastWorkspaceRow } from "~/utils/cast-workspace";

const props = defineProps<{
  rows: CastWorkspaceRow[];
  selectedKey: string | null;
}>();

const emit = defineEmits<{
  add: [];
  remove: [key: string];
  "update:selectedKey": [key: string | null];
}>();

const query = ref("");
const debouncedQuery = refDebounced(query, 150);
const visibleRows = computed(() => filterCastRows(props.rows, debouncedQuery.value));
</script>
