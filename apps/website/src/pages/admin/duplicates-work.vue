<template>
  <section class="space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p
          class="text-xs font-semibold uppercase tracking-[0.18em] theme-status-info-text"
        >
          {{ t("admin.duplicatesWork.reviewEyebrow") }}
        </p>
        <h1 class="mt-1 text-2xl font-bold theme-text">
          {{ t("admin.duplicatesWork.title") }}
        </h1>
        <p class="mt-1 max-w-2xl text-sm theme-text-muted">
          {{ t("admin.duplicatesWork.description") }}
        </p>
      </div>
      <button
        type="button"
        @click="scan"
        :disabled="loading || merging"
        class="rounded-lg border theme-border px-4 py-2 text-sm font-semibold theme-text transition hover:theme-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-color-focus)] disabled:opacity-50"
      >
        {{
          loading
            ? t("admin.duplicatesWork.scanningAssociations")
            : t("admin.duplicatesWork.scanDuplicates")
        }}
      </button>
    </header>

    <div
      v-if="error"
      role="alert"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--app-color-danger-border)] theme-status-danger px-4 py-3 text-sm theme-status-danger-text"
    >
      <span>{{ error }}</span>
      <button
        v-if="stale"
        type="button"
        @click="scan"
        class="font-semibold underline"
      >
        {{ t("admin.duplicatesWork.reloadGroup") }}
      </button>
    </div>
    <div
      v-if="notice"
      role="status"
      class="rounded-lg border border-[var(--app-color-success-border)] theme-status-success px-4 py-3 text-sm theme-status-success-text"
    >
      {{ notice }}
    </div>

    <div
      v-if="loading && groups.length === 0"
      aria-busy="true"
      class="rounded-lg border theme-border theme-surface-overlay p-8 text-center text-sm theme-text-muted"
    >
      {{ t("admin.duplicatesWork.scanningAssociations") }}
    </div>

    <div
      v-else-if="!currentGroup"
      role="status"
      class="rounded-lg border theme-border theme-surface-overlay px-6 py-16 text-center"
    >
      <h2 class="text-lg font-semibold theme-text">
        {{ t("admin.duplicatesWork.noDuplicatesFound") }}
      </h2>
      <p class="mx-auto mt-2 max-w-lg text-sm theme-text-muted">
        {{ t("admin.duplicatesWork.allUnique") }}
      </p>
    </div>

    <template v-else>
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border theme-border theme-surface-overlay px-4 py-3"
      >
        <div class="flex items-center gap-3">
          <span class="font-mono text-sm font-bold theme-text"
            >{{ currentIndex + 1 }} / {{ totalGroups }}</span
          >
          <span
            class="rounded-full theme-surface-muted px-2.5 py-1 text-xs font-semibold theme-text-secondary"
            >{{
              t("admin.duplicatesWork.recordsInGroup", {
                count: currentGroup.works.length,
              })
            }}</span
          >
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="move(-1)"
            :disabled="currentIndex === 0 || merging"
            :aria-label="t('admin.duplicatesWork.previousGroup')"
            class="rounded-md border theme-border px-3 py-2 text-sm theme-text disabled:opacity-40"
          >
            {{ t("admin.duplicatesWork.previous") }}
          </button>
          <button
            type="button"
            @click="move(1)"
            :disabled="currentIndex === groups.length - 1 || merging"
            :aria-label="t('admin.duplicatesWork.nextGroup')"
            class="rounded-md border theme-border px-3 py-2 text-sm theme-text disabled:opacity-40"
          >
            {{ t("admin.duplicatesWork.next") }}
          </button>
        </div>
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border theme-border theme-surface-overlay px-4 py-3 text-sm"
      >
        <div class="min-w-0">
          <p class="font-semibold theme-text">
            {{
              t("admin.duplicatesWork.mediaContext", {
                type: currentGroup.project.contentType,
                id: currentGroup.project.contentId,
              })
            }}
          </p>
          <p class="mt-1 text-xs theme-text-muted">
            {{
              t("admin.duplicatesWork.language", {
                language:
                  currentGroup.project.language ||
                  t("admin.duplicatesWork.none"),
              })
            }}
          </p>
          <p class="mt-1 theme-text-muted">
            {{
              t("admin.duplicatesWork.identityContext", {
                project: currentGroup.identity.dubbingProjectId,
                actor: displayId(currentGroup.identity.actorId),
                character: displayCharacter(currentGroup),
                voiceActor: displayVoiceActor(currentGroup),
              })
            }}
          </p>
        </div>
        <NuxtLink
          :to="mediaPath"
          class="shrink-0 rounded-md border theme-border px-3 py-2 font-semibold theme-status-info-text hover:underline"
          >{{ t("admin.duplicatesWork.openMedia") }}</NuxtLink
        >
      </div>

      <section class="space-y-3 lg:hidden">
        <div
          class="rounded-lg border-2 theme-primary-border theme-surface-overlay p-4"
        >
          <div class="mb-4 flex items-center justify-between">
            <h2 class="font-bold theme-text">
              {{ t("admin.duplicatesWork.finalResult") }}
            </h2>
            <label class="text-xs theme-text-muted"
              >{{ t("admin.duplicatesWork.keepRecord") }}
              <select
                :value="canonicalId"
                @change="onCanonicalChange"
                class="ml-2 max-w-36 rounded-md border theme-border theme-input px-2 py-1 theme-text"
              >
                <option
                  v-for="work in currentGroup.works"
                  :key="work.id"
                  :value="work.id"
                >
                  #{{ work.id }}
                </option>
              </select>
            </label>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label
              v-for="field in textFields"
              :key="field.key"
              class="block text-xs font-semibold theme-text-muted"
              >{{ t(field.label) }}
              <input
                :value="finalValues[field.key] ?? ''"
                @input="setFinalText(field.key, $event)"
                :aria-label="t(field.label)"
                class="mt-1 w-full rounded-md border theme-border theme-input px-3 py-2 text-sm theme-text focus-visible:outline-2 focus-visible:outline-[var(--app-color-focus)]"
              />
            </label>
            <label class="block text-xs font-semibold theme-text-muted"
              >{{ t("admin.duplicatesWork.reviewStatus") }}
              <select
                v-model="finalValues.reviewed_status"
                class="mt-1 w-full rounded-md border theme-border theme-input px-3 py-2 text-sm theme-text"
              >
                <option :value="null">—</option>
                <option value="waiting">waiting</option>
                <option value="accepted">accepted</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <label
              class="flex items-center gap-2 self-end rounded-md border theme-border px-3 py-2 text-sm theme-text"
              ><input
                v-model="finalValues.highlight"
                type="checkbox"
                class="accent-[var(--app-color-primary)]"
              />{{ t("admin.duplicatesWork.highlight") }}</label
            >
            <label class="block text-xs font-semibold theme-text-muted"
              >{{ t("admin.duplicatesWork.source") }}
              <input
                :value="finalValues.source_id ?? ''"
                type="number"
                min="1"
                @input="setFinalNumber('source_id', $event)"
                class="mt-1 w-full rounded-md border theme-border theme-input px-3 py-2 text-sm theme-text"
              />
            </label>
            <label
              class="block text-xs font-semibold theme-text-muted sm:col-span-2"
              >{{ t("admin.duplicatesWork.note") }}
              <textarea
                v-model="finalValues.note"
                rows="2"
                class="mt-1 w-full rounded-md border theme-border theme-input px-3 py-2 text-sm theme-text"
              />
            </label>
          </div>
          <ul
            class="mt-4 grid gap-1 border-t theme-border pt-3 text-[11px] theme-text-muted sm:grid-cols-2"
          >
            <li v-for="field in matrixFields" :key="`source-${field.key}`">
              {{ t(field.label) }} ·
              {{
                t("admin.duplicatesWork.prefilledFrom", {
                  id: provenance[field.key],
                })
              }}
            </li>
          </ul>
        </div>
        <div class="overflow-x-auto pb-2">
          <div class="flex min-w-max gap-3">
            <article
              v-for="work in currentGroup.works"
              :key="work.id"
              class="w-64 rounded-lg border theme-border theme-surface-overlay p-4 text-sm"
            >
              <h3 class="font-bold theme-text">
                {{ t("admin.duplicatesWork.sourceRecord", { id: work.id }) }}
              </h3>
              <p class="mt-1 text-xs theme-text-muted">
                {{
                  t("admin.duplicatesWork.votes", {
                    up: work.upVotes,
                    down: work.downVotes,
                  })
                }}
              </p>
              <p class="mt-1 text-[11px] theme-text-muted">
                {{
                  t("admin.duplicatesWork.updatedAt", {
                    date: formatDate(work.updated_at || work.created_at),
                    user:
                      work.updated_by ||
                      work.created_by ||
                      t("admin.duplicatesWork.none"),
                  })
                }}
              </p>
              <dl class="mt-3 space-y-2">
                <div v-for="field in matrixFields" :key="field.key">
                  <dt class="text-xs theme-text-muted">{{ t(field.label) }}</dt>
                  <dd class="break-words theme-text">
                    {{ formatWorkValue(field.key, work) }}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                @click="chooseCanonicalId(work.id)"
                class="mt-4 w-full rounded-md border theme-border px-3 py-2 text-xs font-semibold theme-text"
              >
                {{ t("admin.duplicatesWork.keepThisRecord") }}
              </button>
            </article>
          </div>
        </div>
      </section>

      <section
        class="hidden overflow-x-auto rounded-lg border theme-border lg:block"
      >
        <table class="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead
            class="theme-surface-raised text-xs uppercase tracking-wide theme-text-muted"
          >
            <tr>
              <th
                class="sticky left-0 z-20 w-40 border-b theme-border theme-surface-raised px-4 py-3"
              >
                {{ t("admin.duplicatesWork.field") }}
              </th>
              <th
                v-for="work in currentGroup.works"
                :key="work.id"
                class="min-w-56 border-b border-l theme-border px-4 py-3"
              >
                {{ t("admin.duplicatesWork.sourceRecord", { id: work.id }) }}
                <span class="mt-1 block normal-case tracking-normal">{{
                  t("admin.duplicatesWork.votes", {
                    up: work.upVotes,
                    down: work.downVotes,
                  })
                }}</span>
              </th>
              <th
                class="sticky right-0 z-10 min-w-72 border-b border-l-2 theme-border theme-surface-raised px-4 py-3 theme-text"
              >
                {{ t("admin.duplicatesWork.finalResult") }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="field in matrixFields"
              :key="field.key"
              class="border-b theme-border"
            >
              <th
                scope="row"
                class="sticky left-0 z-10 theme-surface-overlay px-4 py-3 text-xs font-semibold theme-text-muted"
              >
                {{ t(field.label) }}
              </th>
              <td
                v-for="work in currentGroup.works"
                :key="`${field.key}-${work.id}`"
                class="border-l theme-border px-4 py-3 align-top"
                :class="
                  isDifferent(field.key, work)
                    ? 'theme-status-warning theme-status-warning-text'
                    : 'theme-text-secondary'
                "
              >
                {{ formatValue(work[field.key])
                }}<span
                  v-if="canonicalId === work.id"
                  class="ml-2 rounded theme-surface-muted px-1.5 py-0.5 text-[10px] font-bold"
                  >{{ t("admin.duplicatesWork.canonical") }}</span
                >
              </td>
              <td
                class="sticky right-0 z-[5] border-l-2 theme-border theme-surface-overlay px-3 py-2 align-top shadow-[-8px_0_12px_-12px_currentColor]"
              >
                <template v-if="field.key === 'reviewed_status'"
                  ><select
                    v-model="finalValues.reviewed_status"
                    class="w-full rounded-md border theme-border theme-input px-2 py-2 text-sm theme-text"
                  >
                    <option :value="null">—</option>
                    <option value="waiting">waiting</option>
                    <option value="accepted">accepted</option>
                    <option value="rejected">rejected</option>
                  </select></template
                >
                <template v-else-if="field.key === 'highlight'"
                  ><label
                    class="flex items-center gap-2 py-2 text-sm theme-text"
                    ><input
                      v-model="finalValues.highlight"
                      type="checkbox"
                      class="accent-[var(--app-color-primary)]"
                    />{{
                      finalValues.highlight
                        ? t("admin.duplicatesWork.enabled")
                        : t("admin.duplicatesWork.disabled")
                    }}</label
                  ></template
                >
                <template v-else-if="field.key === 'source_id'"
                  ><input
                    :value="finalValues.source_id ?? ''"
                    type="number"
                    min="1"
                    @input="setFinalNumber('source_id', $event)"
                    class="w-full rounded-md border theme-border theme-input px-2 py-2 text-sm theme-text"
                  /><small
                    v-if="sourceLabel"
                    class="mt-1 block theme-text-muted"
                    >{{ sourceLabel }}</small
                  ></template
                >
                <template v-else-if="field.key === 'note'">
                  <textarea
                    v-model="finalValues.note"
                    rows="2"
                    class="w-full rounded-md border theme-border theme-input px-2 py-2 text-sm theme-text"
                  />
                </template>
                <template v-else
                  ><input
                    :value="finalValues[field.key] ?? ''"
                    @input="setFinalText(field.key, $event)"
                    class="w-full rounded-md border theme-border theme-input px-2 py-2 text-sm theme-text"
                /></template>
                <small class="mt-1 block text-[10px] theme-text-muted">{{
                  t("admin.duplicatesWork.prefilledFrom", {
                    id: provenance[field.key],
                  })
                }}</small>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th
                class="sticky left-0 z-10 theme-surface-overlay px-4 py-3 text-xs theme-text-muted"
              >
                {{ t("admin.duplicatesWork.keepRecord") }}
              </th>
              <td
                v-for="work in currentGroup.works"
                :key="`keep-${work.id}`"
                class="border-l theme-border px-4 py-3"
              >
                <button
                  type="button"
                  @click="chooseCanonicalId(work.id)"
                  class="rounded-md border theme-border px-3 py-2 text-xs font-semibold theme-text"
                >
                  {{ t("admin.duplicatesWork.keepThisRecord") }}
                </button>
              </td>
              <td
                class="sticky right-0 z-[5] border-l-2 theme-border theme-surface-overlay px-4 py-3 text-sm font-semibold theme-text"
              >
                #{{ canonicalId }} ·
                {{
                  t("admin.duplicatesWork.resultOf", {
                    count: currentGroup.works.length,
                  })
                }}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <footer
        class="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 border theme-border theme-surface-raised px-4 py-3 shadow-lg"
      >
        <p class="text-xs theme-text-muted">
          {{
            t("admin.duplicatesWork.mergeSummary", {
              keep: canonicalId,
              remove: currentGroup.works.length - 1,
            })
          }}
        </p>
        <button
          type="button"
          @click="confirmOpen = true"
          :disabled="merging"
          class="rounded-md bg-[var(--app-color-primary)] px-4 py-2.5 text-sm font-bold text-[var(--app-color-on-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-color-focus)] disabled:opacity-50"
        >
          {{
            merging
              ? t("admin.duplicatesWork.merging")
              : t("admin.duplicatesWork.reviewAndMerge")
          }}
        </button>
      </footer>
    </template>

    <DialogRoot v-model:open="confirmOpen">
      <DialogPortal>
        <DialogOverlay
          class="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
        />
        <DialogContent
          class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border theme-border theme-surface p-6 shadow-2xl focus:outline-none"
        >
          <DialogTitle class="text-lg font-bold theme-text">{{
            t("admin.duplicatesWork.confirmTitle")
          }}</DialogTitle>
          <DialogDescription class="mt-2 text-sm theme-text-muted">{{
            t("admin.duplicatesWork.confirmDescription", {
              keep: canonicalId,
              remove: (currentGroup?.works.length || 1) - 1,
              votes: voteCount,
            })
          }}</DialogDescription>
          <div class="mt-5 flex justify-end gap-3">
            <DialogClose
              class="rounded-md border theme-border px-4 py-2 text-sm font-semibold theme-text"
              >{{ t("common.cancel") }}</DialogClose
            >
            <button
              type="button"
              @click="mergeGroup"
              :disabled="merging"
              class="rounded-md bg-[var(--app-color-danger-bg)] px-4 py-2 text-sm font-bold theme-status-danger-text disabled:opacity-50"
            >
              {{
                merging
                  ? t("admin.duplicatesWork.merging")
                  : t("admin.duplicatesWork.confirmMerge")
              }}
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import {
  canPrefetchDuplicateWorkPage,
  duplicateWorkDraftHasChanges,
  editableWorkFields,
  prefillDuplicateWork,
  rankDuplicateWorks,
  type DuplicateWorkGroup,
  type DuplicateWorkPage,
  type EditableWorkField,
  type EditableWorkValues,
} from "~/utils/duplicate-work";

definePageMeta({ layout: "admin", middleware: "admin" });

const { t, locale } = useI18n();
const localePath = useLocalePath();
const groups = ref<DuplicateWorkGroup[]>([]);
const cursor = ref<number | null>(0);
const currentIndex = ref(0);
const totalGroups = ref(0);
const loading = ref(true);
const merging = ref(false);
const stale = ref(false);
const error = ref("");
const notice = ref("");
const confirmOpen = ref(false);
const canonicalId = ref(0);
const provenance = ref<Record<EditableWorkField, number>>({
  performance: 0,
  status: 0,
  reviewed_status: 0,
  note: 0,
  highlight: 0,
  source_id: 0,
  suggestions: 0,
  character_name: 0,
});
const finalValues = ref<EditableWorkValues>({
  performance: null,
  status: null,
  reviewed_status: null,
  note: null,
  highlight: null,
  source_id: null,
  suggestions: null,
  character_name: null,
});
const initialFinalValues = ref<EditableWorkValues>({ ...finalValues.value });
const hasUnsavedChanges = computed(
  () =>
    currentGroup.value !== null &&
    duplicateWorkDraftHasChanges(initialFinalValues.value, finalValues.value),
);

const textFields = [
  { key: "performance", label: "admin.duplicatesWork.performance" },
  { key: "status", label: "common.status" },
  { key: "character_name", label: "admin.duplicatesWork.characterName" },
  { key: "suggestions", label: "admin.duplicatesWork.suggestions" },
] as const;
const matrixFields = editableWorkFields.map((key) => ({
  key,
  label:
    key === "status"
      ? "common.status"
      : `admin.duplicatesWork.${key === "reviewed_status" ? "reviewStatus" : key === "source_id" ? "source" : key === "character_name" ? "characterName" : key}`,
}));
const currentGroup = computed(() => groups.value[currentIndex.value] ?? null);
const currentCanonical = computed(
  () =>
    currentGroup.value?.works.find((work) => work.id === canonicalId.value) ??
    null,
);
const voteCount = computed(
  () =>
    currentGroup.value?.works.reduce((sum, work) => sum + work.voteCount, 0) ??
    0,
);
const sourceLabel = computed(
  () =>
    currentGroup.value?.works.find(
      (work) => work.id === provenance.value.source_id,
    )?.sourceName ?? "",
);
const mediaPath = computed(() => {
  const project = currentGroup.value?.project;
  if (!project) return localePath("/");
  const type = ["tv", "series"].includes(project.contentType)
    ? "show"
    : project.contentType;
  return localePath(`/${type}/${project.contentId}`);
});

function displayId(value: number | null): string {
  return value === null ? t("admin.duplicatesWork.none") : `#${value}`;
}
function displayCharacter(group: DuplicateWorkGroup): string {
  const name = group.works.find((work) => work.character_name)?.character_name;
  return name
    ? `${name} · ${displayId(group.identity.characterId)}`
    : displayId(group.identity.characterId);
}
function displayVoiceActor(group: DuplicateWorkGroup): string {
  const voiceActor = group.works.find((work) => work.voiceActor)?.voiceActor;
  return voiceActor
    ? `${voiceActor.firstName} ${voiceActor.lastName} · #${voiceActor.id}`
    : displayId(group.identity.voiceActorId);
}
function formatValue(value: string | number | boolean | null): string {
  if (value === null || value === "") return t("admin.duplicatesWork.none");
  if (typeof value === "boolean")
    return value
      ? t("admin.duplicatesWork.enabled")
      : t("admin.duplicatesWork.disabled");
  return String(value);
}
function formatWorkValue(
  field: EditableWorkField,
  work: DuplicateWorkGroup["works"][number],
): string {
  if (field === "source_id" && work.source_id !== null && work.sourceName)
    return `${work.source_id} · ${work.sourceName}`;
  return formatValue(work[field]);
}
function formatDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleString(locale.value)
    : t("admin.duplicatesWork.none");
}
function setFinalText(field: EditableWorkField, event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const value = target.value || null;
  switch (field) {
    case "performance":
      finalValues.value.performance = value;
      break;
    case "status":
      finalValues.value.status = value;
      break;
    case "character_name":
      finalValues.value.character_name = value;
      break;
    case "suggestions":
      finalValues.value.suggestions = value;
      break;
    default:
      break;
  }
}
function setFinalNumber(field: "source_id", event: Event): void {
  const target = event.target;
  if (target instanceof HTMLInputElement)
    finalValues.value[field] = target.value ? Number(target.value) : null;
}
function isDifferent(
  field: EditableWorkField,
  work: DuplicateWorkGroup["works"][number],
): boolean {
  return (
    currentGroup.value?.works.some((entry) => entry[field] !== work[field]) ??
    false
  );
}
function resetFinalValues(): void {
  if (!currentGroup.value) return;
  const ranked = rankDuplicateWorks(currentGroup.value.works);
  const canonical =
    ranked.find((work) => work.id === canonicalId.value) ?? ranked[0];
  if (!canonical) return;
  canonicalId.value = canonical.id;
  const result = prefillDuplicateWork(canonical, ranked);
  finalValues.value = result.values;
  initialFinalValues.value = { ...result.values };
  provenance.value = result.provenance;
}
function confirmDiscardChanges(): boolean {
  return (
    !hasUnsavedChanges.value ||
    window.confirm(t("admin.duplicatesWork.discardChangesConfirm"))
  );
}
function chooseCanonicalId(id: number): void {
  if (id === canonicalId.value || !currentGroup.value) return;
  if (!window.confirm(t("admin.duplicatesWork.changeCanonicalConfirm"))) return;
  canonicalId.value = id;
  resetFinalValues();
}
function onCanonicalChange(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLSelectElement) {
    chooseCanonicalId(Number(target.value));
    target.value = String(canonicalId.value);
  }
}
function move(direction: -1 | 1): void {
  const next = currentIndex.value + direction;
  if (next < 0 || next >= groups.value.length) return;
  if (!confirmDiscardChanges()) return;
  currentIndex.value = next;
  resetFinalValues();
  error.value = "";
  notice.value = "";
}
async function loadPage(after: number): Promise<DuplicateWorkPage> {
  return await $fetch<DuplicateWorkPage>(
    `/api/admin/work-duplicates?after=${after}&limit=20`,
  );
}
async function scan(): Promise<void> {
  if (!confirmDiscardChanges()) return;
  loading.value = true;
  error.value = "";
  notice.value = "";
  stale.value = false;
  cursor.value = 0;
  groups.value = [];
  currentIndex.value = 0;
  try {
    const page = await loadPage(0);
    groups.value = page.items;
    cursor.value = page.nextCursor;
    totalGroups.value = page.totalGroups;
    resetFinalValues();
  } catch (cause: unknown) {
    error.value =
      cause instanceof Error
        ? cause.message
        : t("admin.duplicatesWork.scanFailed");
  } finally {
    loading.value = false;
  }
}
async function loadNextPage(): Promise<void> {
  if (cursor.value === null || loading.value) return;
  loading.value = true;
  let succeeded = false;
  try {
    const page = await loadPage(cursor.value);
    groups.value.push(...page.items);
    cursor.value = page.nextCursor;
    totalGroups.value = page.totalGroups;
    succeeded = true;
  } catch (cause: unknown) {
    error.value =
      cause instanceof Error
        ? cause.message
        : t("admin.duplicatesWork.scanFailed");
  } finally {
    loading.value = false;
    if (
      canPrefetchDuplicateWorkPage(
        succeeded,
        currentIndex.value,
        groups.value.length,
        cursor.value,
      )
    ) {
      void loadNextPage();
    }
  }
}
async function mergeGroup(): Promise<void> {
  if (!currentGroup.value || !currentCanonical.value) return;
  merging.value = true;
  stale.value = false;
  error.value = "";
  try {
    await $fetch("/api/admin/work-duplicates/merge", {
      method: "POST",
      body: {
        canonicalId: canonicalId.value,
        workIds: currentGroup.value.works.map((work) => work.id),
        updates: Object.fromEntries(
          editableWorkFields.map((field) => [field, finalValues.value[field]]),
        ),
      },
    });
    confirmOpen.value = false;
    groups.value.splice(currentIndex.value, 1);
    totalGroups.value = Math.max(totalGroups.value - 1, 0);
    canonicalId.value = 0;
    notice.value = t("admin.duplicatesWork.mergeSucceeded");
    if (currentIndex.value >= groups.value.length && currentIndex.value > 0)
      currentIndex.value -= 1;
    if (groups.value.length === 0 && cursor.value !== null) await scan();
    else resetFinalValues();
  } catch (cause: unknown) {
    const response =
      cause && typeof cause === "object" && "data" in cause ? cause.data : null;
    const statusMessage =
      response && typeof response === "object" && "statusMessage" in response
        ? response.statusMessage
        : null;
    stale.value = statusMessage === "DUPLICATE_GROUP_CHANGED";
    error.value = stale.value
      ? t("admin.duplicatesWork.staleGroup")
      : cause instanceof Error
        ? cause.message
        : t("admin.duplicatesWork.mergeFailed");
  } finally {
    merging.value = false;
  }
}

watch(currentIndex, async () => {
  if (currentIndex.value >= groups.value.length - 2 && cursor.value !== null)
    await loadNextPage();
});
onMounted(scan);
</script>
