<template>
  <AdminFormCard
    :title="$t('projectEditor.castOrderTitle')"
    :description="$t('projectEditor.castOrderDescription')"
    data-testid="cast-order"
  >
    <p v-if="loadError" class="text-sm theme-status-warning-text" role="alert">
      {{ loadError }}
      <button
        type="button"
        class="ml-2 min-h-11 font-semibold underline-offset-2 hover:underline"
        @click="load"
      >
        {{ $t("projectEditor.castOrderReload") }}
      </button>
    </p>

    <template v-else-if="loaded">
      <!-- Ranked characters, positions 1..n. -->
      <ol v-if="draft.length > 0" class="space-y-2" data-testid="cast-order-ranked">
        <li
          v-for="(id, index) in draft"
          :key="id"
          class="flex items-center gap-2 rounded-xl border theme-border p-2 transition-colors"
          :class="[
            dropIndex === index ? 'ring-2 ring-[var(--app-color-focus)]' : '',
            dragIndex === index ? 'opacity-60' : '',
          ]"
          draggable="true"
          data-testid="cast-order-item"
          @dragstart="onDragStart($event, index)"
          @dragover="onDragOver($event, index)"
          @drop="onDrop($event, index)"
          @dragend="resetDrag"
        >
          <GripVerticalIcon
            class="h-4 w-4 shrink-0 cursor-grab theme-text-muted"
            :aria-label="$t('projectEditor.castOrderDrag')"
          />
          <span
            class="w-8 shrink-0 text-right text-sm font-semibold tabular-nums theme-text-secondary"
          >
            {{ index + 1 }}
          </span>
          <span class="min-w-0 flex-1 truncate text-sm font-semibold theme-text">
            {{ nameOf(id) }}
            <span
              v-if="projectCharacterSet.has(id)"
              class="ml-1 text-xs font-normal theme-text-muted"
            >
              · {{ $t("projectEditor.castOrderInProject") }}
            </span>
          </span>
          <button
            type="button"
            :class="iconButton"
            :disabled="index === 0"
            :aria-label="$t('projectEditor.castOrderMoveUp', { name: nameOf(id) })"
            data-testid="cast-order-up"
            @click="move(index, index - 1)"
          >
            <ArrowUpIcon class="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            :class="iconButton"
            :disabled="index === draft.length - 1"
            :aria-label="$t('projectEditor.castOrderMoveDown', { name: nameOf(id) })"
            data-testid="cast-order-down"
            @click="move(index, index + 1)"
          >
            <ArrowDownIcon class="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            :class="iconButton"
            :aria-label="$t('projectEditor.castOrderRemove', { name: nameOf(id) })"
            data-testid="cast-order-remove"
            @click="remove(index)"
          >
            <XIcon class="h-4 w-4" aria-hidden="true" />
          </button>
        </li>
      </ol>
      <p v-else class="text-sm theme-text-muted">{{ $t("projectEditor.castOrderEmpty") }}</p>

      <!-- Unranked characters: never ranked implicitly, the editor adds them. -->
      <div class="space-y-2">
        <h3 class="text-xs font-semibold uppercase tracking-wide theme-text-muted">
          {{ $t("projectEditor.castOrderUnranked", { count: unranked.length }) }}
        </h3>
        <input
          v-model="query"
          type="search"
          :aria-label="$t('projectEditor.castOrderSearch')"
          :placeholder="$t('projectEditor.castOrderSearch')"
          class="h-11 w-full rounded-xl border theme-border theme-input px-3 text-base sm:text-sm theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)]"
          data-testid="cast-order-search"
        />
        <ul class="space-y-1" data-testid="cast-order-unranked">
          <li
            v-for="character in visibleUnranked"
            :key="character.key"
            class="flex items-center gap-2 rounded-xl px-2 py-1"
          >
            <span class="min-w-0 flex-1 truncate text-sm theme-text">
              {{ character.name }}
              <span v-if="character.inProject" class="ml-1 text-xs theme-text-muted">
                · {{ $t("projectEditor.castOrderInProject") }}
              </span>
              <span
                v-else-if="character.gameCharacterId === null"
                class="ml-1 text-xs theme-text-muted"
              >
                · {{ $t("projectEditor.castOrderIgdbOnly") }}
              </span>
            </span>
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold theme-text-secondary theme-hover-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)] disabled:opacity-50"
              :disabled="busy"
              data-testid="cast-order-add"
              @click="add(character)"
            >
              <PlusIcon class="h-4 w-4" aria-hidden="true" />
              {{ $t("projectEditor.castOrderAdd") }}
            </button>
          </li>
        </ul>
        <button
          v-if="filteredUnranked.length > visibleUnranked.length"
          type="button"
          class="min-h-11 px-2 text-sm font-semibold theme-status-info-text hover:underline"
          @click="limit += 30"
        >
          {{ $t("projectEditor.castOrderShowMore") }}
        </button>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2 border-t theme-border pt-3">
        <p v-if="conflict" class="mr-auto text-sm theme-status-warning-text" role="alert">
          {{ $t("projectEditor.castOrderConflict") }}
        </p>
        <button
          v-if="dirty || conflict"
          type="button"
          class="min-h-11 rounded-xl px-4 text-sm font-semibold theme-text-secondary theme-hover-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
          :disabled="busy"
          data-testid="cast-order-reset"
          @click="conflict ? load() : reset()"
        >
          {{ conflict ? $t("projectEditor.castOrderReload") : $t("projectEditor.castOrderReset") }}
        </button>
        <button
          type="button"
          class="min-h-11 rounded-xl px-4 text-sm font-semibold theme-primary-bg hover:bg-[var(--app-color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)] disabled:opacity-50"
          :disabled="!dirty || busy || conflict"
          data-testid="cast-order-save"
          @click="save"
        >
          {{ $t("projectEditor.castOrderSave") }}
        </button>
      </div>
    </template>
  </AdminFormCard>
</template>

<script setup lang="ts">
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, PlusIcon, XIcon } from "lucide-vue-next";
import { refDebounced } from "@vueuse/core";
import { computed, onMounted, ref } from "vue";
import {
  createRequestId,
  getDubbingProjectSaveErrorMessage,
  isDubbingProjectSaveConflict,
} from "~/utils/dubbing-project-save";
import { moveItem } from "~/utils/game-cast-order";

/** A character of the game's catalog: registered in DubbingBase (with an id) or only on IGDB. */
export interface CastOrderCatalogCharacter {
  key: string;
  name: string;
  gameCharacterId: string | null;
}

interface CastOrder {
  version: number;
  characters: { game_character_id: string; name: string; position: number }[];
}

const props = defineProps<{
  gameId: number;
  characters: CastOrderCatalogCharacter[];
  /** Game characters credited in the project being edited, listed first among the unranked. */
  projectCharacterIds: string[];
}>();

const emit = defineEmits<{
  /** The saved order: game character id -> position. */
  saved: [ranks: Record<string, number>];
  /** A character was registered for the game; reload the catalog. */
  registered: [];
}>();

const iconButton =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl theme-text-secondary theme-hover-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)] disabled:opacity-40";

const loaded = ref(false);
const loadError = ref<string | null>(null);
const saved = ref<CastOrder>({ version: 0, characters: [] });
const draft = ref<string[]>([]);
const busy = ref(false);
const conflict = ref(false);
const names = ref<Record<string, string>>({});

const projectCharacterSet = computed(() => new Set(props.projectCharacterIds));
const savedIds = computed(() =>
  saved.value.characters.map((character) => character.game_character_id),
);
const dirty = computed(() => draft.value.join(",") !== savedIds.value.join(","));

const nameOf = (id: string) =>
  names.value[id] ??
  props.characters.find((character) => character.gameCharacterId === id)?.name ??
  id;

const ranksOf = (order: CastOrder) =>
  Object.fromEntries(
    order.characters.map((character) => [character.game_character_id, character.position]),
  );

const apply = (order: CastOrder) => {
  saved.value = order;
  draft.value = order.characters.map((character) => character.game_character_id);
  for (const character of order.characters)
    names.value[character.game_character_id] = character.name;
  conflict.value = false;
  emit("saved", ranksOf(order));
};

const load = async () => {
  loadError.value = null;
  try {
    apply(await $fetch<CastOrder>(`/api/game-cast-order/${props.gameId}`));
    loaded.value = true;
  } catch (error) {
    loadError.value = getDubbingProjectSaveErrorMessage(error);
  }
};
onMounted(load);

const reset = () => {
  draft.value = [...savedIds.value];
};
const move = (from: number, to: number) => {
  draft.value = moveItem(draft.value, from, to);
};
const remove = (index: number) => {
  draft.value = draft.value.filter((_, position) => position !== index);
};

const add = async (character: CastOrderCatalogCharacter & { inProject: boolean }) => {
  if (character.gameCharacterId) {
    draft.value = [...draft.value, character.gameCharacterId];
    return;
  }
  // An IGDB-only character is registered for the game first; the order lists game characters.
  busy.value = true;
  try {
    const created = await $fetch<{ character: { id: string; name: string } }>(
      "/api/game-characters",
      {
        method: "POST",
        body: { request_id: createRequestId(), igdb_game_id: props.gameId, name: character.name },
      },
    );
    names.value[created.character.id] = created.character.name;
    draft.value = [...draft.value, created.character.id];
    emit("registered");
  } catch (error) {
    loadError.value = getDubbingProjectSaveErrorMessage(error);
  } finally {
    busy.value = false;
  }
};

const save = async () => {
  busy.value = true;
  try {
    apply(
      await $fetch<CastOrder>(`/api/game-cast-order/${props.gameId}`, {
        method: "PUT",
        body: { expected_version: saved.value.version, characters: draft.value },
      }),
    );
  } catch (error) {
    if (isDubbingProjectSaveConflict(error)) conflict.value = true;
    else loadError.value = getDubbingProjectSaveErrorMessage(error);
  } finally {
    busy.value = false;
  }
};

// Unranked: registered characters not in the draft (credited in this project first), then
// IGDB-only characters. Only a bounded slice is rendered.
const query = ref("");
const debouncedQuery = refDebounced(query, 150);
const limit = ref(30);
const unranked = computed(() => {
  const inDraft = new Set(draft.value);
  return props.characters
    .filter((character) => !character.gameCharacterId || !inDraft.has(character.gameCharacterId))
    .map((character) => ({
      ...character,
      inProject:
        character.gameCharacterId !== null &&
        projectCharacterSet.value.has(character.gameCharacterId),
    }))
    .sort(
      (left, right) =>
        Number(right.inProject) - Number(left.inProject) ||
        Number(left.gameCharacterId === null) - Number(right.gameCharacterId === null) ||
        left.name.localeCompare(right.name),
    );
});
const filteredUnranked = computed(() => {
  const needle = debouncedQuery.value.trim().toLowerCase();
  return needle
    ? unranked.value.filter((character) => character.name.toLowerCase().includes(needle))
    : unranked.value;
});
const visibleUnranked = computed(() => filteredUnranked.value.slice(0, limit.value));

// Native drag and drop within the ranked list; the buttons cover keyboard and touch.
const dragIndex = ref<number | null>(null);
const dropIndex = ref<number | null>(null);
const resetDrag = () => {
  dragIndex.value = null;
  dropIndex.value = null;
};
const onDragStart = (event: DragEvent, index: number) => {
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }
};
const onDragOver = (event: DragEvent, index: number) => {
  if (dragIndex.value === null) return;
  event.preventDefault();
  dropIndex.value = index;
};
const onDrop = (event: DragEvent, index: number) => {
  if (dragIndex.value === null) return;
  event.preventDefault();
  move(dragIndex.value, index);
  resetDrag();
};
</script>
