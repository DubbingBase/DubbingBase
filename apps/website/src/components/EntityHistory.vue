<template>
  <DialogRoot v-model:open="isOpen">
    <button
      type="button"
      class="text-sm theme-text-muted theme-hover-text transition-colors flex items-center gap-1.5 min-h-8 theme-focus rounded-lg"
      :aria-label="$t('history.title')"
      :title="$t('history.title')"
      data-testid="history-trigger"
      @click="isOpen = true"
    >
      <HistoryIcon class="w-4 h-4" aria-hidden="true" />
      <span class="hidden sm:inline">{{ $t("history.button") }}</span>
    </button>

    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
      <DialogContent
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-1rem)] sm:w-[92vw] max-w-2xl max-h-[85vh] z-50 theme-surface border theme-border rounded-2xl shadow-2xl overflow-hidden focus:outline-none flex flex-col"
      >
        <header
          class="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b theme-border"
        >
          <div class="min-w-0">
            <DialogTitle class="text-lg sm:text-xl font-bold theme-text">
              {{ $t("history.title") }}
            </DialogTitle>
            <DialogDescription class="text-sm theme-text-muted truncate">
              {{ entityName || $t("history.description") }}
            </DialogDescription>
          </div>
          <DialogClose
            class="shrink-0 -m-1 p-2 rounded-lg theme-text-muted theme-hover-text theme-hover-surface-muted theme-focus"
            :aria-label="$t('history.close')"
          >
            <XIcon class="w-5 h-5" aria-hidden="true" />
          </DialogClose>
        </header>

        <div
          v-if="isLoaded && entries.length > 0"
          class="flex gap-2 overflow-x-auto no-scrollbar px-4 sm:px-6 py-3 border-b theme-border-subtle theme-surface"
          role="group"
          :aria-label="$t('history.filters.label')"
        >
          <button
            v-for="chip in HISTORY_FILTERS"
            :key="chip"
            type="button"
            class="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 min-h-9 text-sm font-medium transition-colors theme-focus"
            :class="
              filter === chip
                ? 'theme-primary-bg theme-primary-border'
                : 'theme-surface theme-border theme-text-secondary theme-hover-surface-muted'
            "
            :aria-pressed="filter === chip"
            :data-testid="`history-filter-${chip}`"
            @click="filter = chip"
          >
            {{ $t(`history.filters.${chip}`) }}
            <span class="text-xs opacity-80 tabular-nums">{{ counts[chip] }}</span>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-4 sm:px-6 py-4" aria-live="polite">
          <!-- Loading -->
          <div v-if="isLoading && !isLoaded" class="space-y-3" role="status">
            <span class="sr-only">{{ $t("history.loading") }}</span>
            <div
              v-for="n in 3"
              :key="n"
              class="h-24 rounded-xl theme-surface-muted animate-pulse"
              aria-hidden="true"
            ></div>
          </div>

          <!-- Error -->
          <div v-else-if="hasError" class="py-10 text-center space-y-3">
            <p class="text-sm theme-status-danger-text">{{ $t("history.error") }}</p>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border theme-border px-4 min-h-10 text-sm font-medium theme-surface theme-text-secondary theme-hover-surface-muted theme-focus"
              @click="load"
            >
              <RefreshCwIcon class="w-4 h-4" aria-hidden="true" />
              {{ $t("history.retry") }}
            </button>
          </div>

          <!-- Empty -->
          <p v-else-if="entries.length === 0" class="py-10 text-center text-sm theme-text-muted">
            {{ $t("history.empty") }}
          </p>
          <p
            v-else-if="visibleEntries.length === 0"
            class="py-10 text-center text-sm theme-text-muted"
          >
            {{ $t("history.emptyFilter") }}
          </p>

          <!-- Entries -->
          <div v-else class="space-y-6">
            <section v-for="group in groups" :key="group.key" :aria-label="dayHeading(group.date)">
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide theme-text-muted">
                {{ dayHeading(group.date) }}
              </h3>
              <ol class="space-y-3">
                <li
                  v-for="entry in group.entries"
                  :key="entry.id"
                  class="flex overflow-hidden rounded-xl border"
                  :class="[
                    entry.important && !entry.reverted
                      ? 'border-2 theme-status-warning'
                      : 'theme-border theme-surface-raised',
                    entry.reverted ? 'opacity-70 theme-surface-muted' : '',
                  ]"
                  :data-testid="`history-entry-${entry.id}`"
                >
                  <span
                    class="w-0 shrink-0 border-l-4"
                    :class="railClass(entry.kind)"
                    aria-hidden="true"
                  ></span>
                  <div class="min-w-0 flex-1 p-3 sm:p-4 space-y-3">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div class="flex min-w-0 items-center gap-2.5">
                        <span
                          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full theme-surface-muted border theme-border text-sm font-semibold theme-text"
                          aria-hidden="true"
                        >
                          {{ initial(entry.contributor) }}
                        </span>
                        <div class="min-w-0">
                          <p class="truncate text-sm font-semibold theme-text">
                            {{ entry.contributor }}
                          </p>
                          <time
                            class="block text-xs theme-text-muted"
                            :datetime="entry.createdAt"
                            :title="absoluteDate(entry.createdAt)"
                          >
                            {{ relativeDate(entry.createdAt) }}
                          </time>
                        </div>
                      </div>

                      <div class="flex flex-wrap items-center gap-2">
                        <template v-if="canRevert && entry.revertable">
                          <template v-if="confirmingId === entry.id">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1.5 rounded-lg border px-3 min-h-9 text-sm font-medium theme-status-danger theme-focus disabled:opacity-60"
                              :disabled="revertingId === entry.id"
                              data-testid="history-revert-confirm"
                              @click="confirmRevert(entry)"
                            >
                              <Loader2Icon
                                v-if="revertingId === entry.id"
                                class="w-4 h-4 animate-spin"
                                aria-hidden="true"
                              />
                              {{ $t("history.revert.confirm") }}
                            </button>
                            <button
                              type="button"
                              class="rounded-lg border theme-border px-3 min-h-9 text-sm font-medium theme-surface theme-text-secondary theme-hover-surface-muted theme-focus"
                              :disabled="revertingId === entry.id"
                              data-testid="history-revert-cancel"
                              @click="confirmingId = null"
                            >
                              {{ $t("history.revert.cancel") }}
                            </button>
                          </template>
                          <button
                            v-else
                            type="button"
                            class="inline-flex items-center gap-1.5 rounded-lg border theme-border px-3 min-h-9 text-sm font-medium theme-surface theme-text-secondary theme-hover-surface-muted theme-focus"
                            data-testid="history-revert"
                            @click="startRevert(entry.id)"
                          >
                            <Undo2Icon class="w-4 h-4" aria-hidden="true" />
                            {{ $t("history.revert.button") }}
                          </button>
                        </template>
                        <span
                          v-else-if="
                            !entry.revertable &&
                            !entry.reverted &&
                            entry.revertBlockedReason === 'changed_since'
                          "
                          class="text-xs theme-text-muted"
                        >
                          {{ $t("history.revert.changedSinceNote") }}
                        </span>
                      </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5">
                      <span
                        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                        :class="badgeClass(entry.kind)"
                      >
                        <component
                          :is="kindIcon(entry.kind)"
                          class="w-3.5 h-3.5"
                          aria-hidden="true"
                        />
                        {{ $t(`history.kinds.${entry.kind}`) }}
                      </span>
                      <span
                        v-if="entry.important"
                        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold theme-status-warning"
                      >
                        <AlertTriangleIcon class="w-3.5 h-3.5" aria-hidden="true" />
                        {{ $t("history.important") }}
                      </span>
                      <span
                        v-if="entry.reverted"
                        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium theme-border theme-surface theme-text-secondary"
                      >
                        <Undo2Icon class="w-3.5 h-3.5" aria-hidden="true" />
                        {{ $t("history.reverted") }}
                      </span>
                      <span
                        v-if="entry.target === 'cast_credit'"
                        class="inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium theme-border theme-surface theme-text-secondary"
                      >
                        <ClapperboardIcon class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span class="truncate">
                          {{ $t("history.castCredit") }}
                          <template v-if="entry.label">: {{ entry.label }}</template>
                        </span>
                      </span>
                      <NuxtLink
                        v-if="entry.target === 'cast_credit' && isSafeHref(entry.href)"
                        :to="safeLocalePath(entry.href)"
                        class="inline-flex items-center gap-1 text-xs font-medium theme-primary-text theme-hover-primary-text theme-focus rounded"
                        @click="isOpen = false"
                      >
                        {{ $t("history.openMedia") }}
                        <ArrowUpRightIcon class="w-3.5 h-3.5" aria-hidden="true" />
                      </NuxtLink>
                    </div>

                    <ul class="space-y-3">
                      <li v-for="change in entry.changes" :key="change.field" class="space-y-1.5">
                        <p class="flex items-center gap-1.5 text-sm theme-text">
                          <span
                            v-if="change.importance === 'high'"
                            class="h-2 w-2 shrink-0 rounded-full theme-primary-bg"
                            :title="$t('history.important')"
                            aria-hidden="true"
                          ></span>
                          <span
                            :class="
                              change.importance === 'high'
                                ? 'font-bold'
                                : 'font-medium theme-text-secondary'
                            "
                          >
                            {{ fieldLabel(change.field) }}
                          </span>
                        </p>
                        <div class="grid gap-2 sm:grid-cols-2">
                          <div
                            v-for="side in sides(entry.id, change)"
                            :key="side.name"
                            class="min-w-0 rounded-lg border px-3 py-2 text-sm"
                            :class="
                              side.name === 'before'
                                ? 'theme-status-danger'
                                : 'theme-status-success'
                            "
                          >
                            <p
                              class="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-80"
                            >
                              {{ $t(`history.${side.name}`) }}
                            </p>
                            <a
                              v-if="change.type === 'image' && side.href"
                              :href="side.href"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-block theme-focus rounded"
                              :aria-label="$t('history.openImage')"
                            >
                              <img
                                :src="side.href"
                                :alt="`${fieldLabel(change.field)} (${$t(`history.${side.name}`)})`"
                                loading="lazy"
                                decoding="async"
                                class="h-16 w-16 rounded-md object-cover border theme-border"
                              />
                            </a>
                            <span
                              v-else-if="side.text === null"
                              class="inline-block rounded-full border theme-border theme-surface theme-text-muted px-2 py-0.5 text-xs"
                            >
                              {{ $t("history.noValue") }}
                            </span>
                            <template v-else>
                              <NuxtLink
                                v-if="side.href && side.href.startsWith('/')"
                                :to="safeLocalePath(side.href)"
                                class="inline-flex items-center gap-1 break-words underline theme-focus rounded"
                                :class="side.name === 'before' ? 'line-through' : ''"
                                @click="isOpen = false"
                              >
                                {{ side.text }}
                              </NuxtLink>
                              <a
                                v-else-if="side.href"
                                :href="side.href"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center gap-1 break-all underline theme-focus rounded"
                                :class="side.name === 'before' ? 'line-through' : ''"
                              >
                                {{ side.text }}
                                <ExternalLinkIcon class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              </a>
                              <template v-else>
                                <p
                                  class="whitespace-pre-line break-words"
                                  :class="[
                                    side.name === 'before' ? 'line-through' : '',
                                    side.clamped ? 'line-clamp-4' : '',
                                  ]"
                                >
                                  {{ side.text }}
                                </p>
                                <button
                                  v-if="side.long"
                                  type="button"
                                  class="mt-1 text-xs font-medium underline theme-focus rounded"
                                  :aria-expanded="!side.clamped"
                                  @click="toggleExpanded(side.key)"
                                >
                                  {{
                                    side.clamped ? $t("history.showMore") : $t("history.showLess")
                                  }}
                                </button>
                              </template>
                            </template>
                          </div>
                        </div>
                      </li>
                    </ul>

                    <p
                      v-if="errors[entry.id]"
                      class="rounded-lg border px-3 py-2 text-sm theme-status-danger"
                      role="alert"
                      data-testid="history-revert-error"
                    >
                      {{ errors[entry.id] }}
                    </p>
                  </div>
                </li>
              </ol>
            </section>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
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
  AlertTriangleIcon,
  ArrowUpRightIcon,
  BadgeCheckIcon,
  ClapperboardIcon,
  ExternalLinkIcon,
  HistoryIcon,
  Loader2Icon,
  PencilIcon,
  PlusCircleIcon,
  RefreshCwIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-vue-next";
import type { Json } from "@app/supabase/types";
import {
  useEntityHistory,
  type HistoryChange,
  type HistoryEntityType,
  type HistoryEntry,
  type HistoryKind,
} from "../composables/useEntityHistory";
import {
  HISTORY_FILTERS,
  countByFilter,
  dayDifference,
  filterEntries,
  formatRelativeTime,
  groupByDay,
  isSafeHref,
  type HistoryFilter,
} from "../utils/entity-history-view";
import { useMediaImage } from "~/composables/useMediaImage";

const mediaImage = useMediaImage();

const props = defineProps<{
  type: HistoryEntityType;
  entityId: string | number | undefined;
  entityName?: string;
}>();

const emit = defineEmits<{ reverted: [] }>();

const { t, te, locale } = useI18n();
const localePath = useLocalePath();
const { entries, canRevert, isLoading, hasError, isLoaded, load, revert } = useEntityHistory(
  props.type,
  () => props.entityId,
);

const isOpen = ref(false);
const filter = ref<HistoryFilter>("all");
const confirmingId = ref<string | null>(null);
const revertingId = ref<string | null>(null);
const errors = ref<Record<string, string>>({});
const expanded = ref<Set<string>>(new Set());

// Data loads lazily the first time the dialog opens.
// A page refresh swaps in a loading skeleton that would unmount this dialog, so the parent is
// told about reverts only once the dialog has closed. The list itself reloads right away.
let didRevert = false;
watch(isOpen, (open) => {
  if (open && !isLoaded.value) void load();
  if (!open) {
    confirmingId.value = null;
    if (didRevert) {
      didRevert = false;
      emit("reverted");
    }
  }
});

const counts = computed(() => countByFilter(entries.value));
const visibleEntries = computed(() => filterEntries(entries.value, filter.value));
const groups = computed(() => groupByDay(visibleEntries.value));

function fieldLabel(field: string): string {
  if (field.startsWith("social_media_links.")) {
    return `${t("history.fields.social_media_links")}: ${field.slice("social_media_links.".length)}`;
  }
  const key = `history.fields.${field}`;
  return te(key) ? t(key) : field;
}

function dayHeading(date: Date): string {
  const diff = dayDifference(date, new Date());
  if (diff === 0) return t("history.today");
  if (diff === 1) return t("history.yesterday");
  return new Intl.DateTimeFormat(locale.value, { dateStyle: "full" }).format(date);
}

function relativeDate(value: string): string {
  return formatRelativeTime(value, locale.value);
}

function absoluteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale.value, { dateStyle: "long", timeStyle: "short" }).format(
    date,
  );
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function safeLocalePath(href: string): string {
  return href.startsWith("/") ? localePath(href) : href;
}

function railClass(kind: HistoryKind): string {
  if (kind === "created") return "theme-status-success";
  if (kind === "deleted") return "theme-status-danger";
  if (kind === "verification") return "theme-status-info";
  return "theme-border-strong";
}

function badgeClass(kind: HistoryKind): string {
  if (kind === "created") return "theme-status-success";
  if (kind === "deleted") return "theme-status-danger";
  if (kind === "verification") return "theme-status-info";
  return "theme-border theme-surface theme-text-secondary";
}

function kindIcon(kind: HistoryKind) {
  if (kind === "created") return PlusCircleIcon;
  if (kind === "deleted") return Trash2Icon;
  if (kind === "verification") return BadgeCheckIcon;
  return PencilIcon;
}

function displayValue(value: Json | null): string | null {
  if (value === null || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

type DiffSide = {
  name: "before" | "after";
  key: string;
  text: string | null;
  href: string | null;
  long: boolean;
  clamped: boolean;
};

const LONG_TEXT_LENGTH = 200;

function sides(entryId: string, change: HistoryChange): DiffSide[] {
  const build = (name: "before" | "after", value: Json | null, href: string | null): DiffSide => {
    const text = displayValue(value);
    const key = `${entryId}:${change.field}:${name}`;
    const displayHref =
      change.type === "image"
        ? mediaImage(href ?? (typeof value === "string" ? value : null), {
            storageBucket:
              change.field === "logo_url" ? "studio_logos" : "voice_actor_profile_pictures",
          })
        : href;
    const long =
      change.type === "text" &&
      !isSafeHref(href) &&
      text !== null &&
      (text.length > LONG_TEXT_LENGTH || text.split("\n").length > 4);
    return {
      name,
      key,
      text,
      href: isSafeHref(displayHref) ? displayHref : null,
      long,
      clamped: long && !expanded.value.has(key),
    };
  };
  return [
    build("before", change.before, change.beforeHref),
    build("after", change.after, change.afterHref),
  ];
}

function toggleExpanded(key: string): void {
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expanded.value = next;
}

function startRevert(id: string): void {
  confirmingId.value = id;
  errors.value = { ...errors.value, [id]: "" };
}

async function confirmRevert(entry: HistoryEntry): Promise<void> {
  if (revertingId.value) return;
  revertingId.value = entry.id;
  const result = await revert(entry.id);
  revertingId.value = null;
  if (result.ok) {
    confirmingId.value = null;
    didRevert = true;
    await load();
    return;
  }
  let message: string;
  if (result.reason === "changed") message = t("history.revert.changedSince");
  else if (result.reason === "unsupported") message = t("history.revert.unsupported");
  else if (result.reason === "forbidden") message = t("history.revert.forbidden");
  else message = result.message ?? t("history.revert.failed");
  errors.value = { ...errors.value, [entry.id]: message };
  confirmingId.value = null;
}
</script>
