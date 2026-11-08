<template>
  <div class="relative">
    <button
      type="button"
      class="min-h-10 px-3 rounded-lg text-sm font-medium transition-colors border theme-border-subtle theme-border theme-surface theme-text-secondary theme-hover-surface-muted flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2"
      :aria-label="$t('common.share')"
      @click="onShare"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      <span>{{ $t("common.share") }}</span>
    </button>

    <p v-if="feedback" role="status" class="sr-only">{{ feedback }}</p>
    <span
      v-if="feedback"
      aria-hidden="true"
      class="absolute right-0 top-full mt-2 z-20 whitespace-nowrap rounded-lg border theme-border theme-surface-overlay px-3 py-1.5 text-sm theme-text shadow-md"
      >{{ feedback }}</span
    >

    <div
      v-if="manualUrl"
      role="group"
      :aria-label="$t('common.shareManualTitle')"
      class="absolute right-0 top-full mt-2 z-20 w-72 max-w-[calc(100vw-2rem)] rounded-lg border theme-border theme-surface-overlay p-3 shadow-md"
    >
      <label for="details-share-url" class="mb-1 block text-sm font-medium theme-text">
        {{ $t("common.shareManualTitle") }}
      </label>
      <input
        id="details-share-url"
        ref="manualInput"
        type="text"
        readonly
        :value="manualUrl"
        class="w-full rounded-md border theme-border theme-input px-2 py-1.5 text-sm"
        @focus="selectInput"
        @keydown.esc="manualUrl = null"
      />
      <p class="mt-1 text-xs theme-text-muted">{{ $t("common.shareManualHint") }}</p>
      <button
        type="button"
        class="mt-2 text-sm theme-primary-text theme-hover-primary-text"
        @click="manualUrl = null"
      >
        {{ $t("common.close") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { buildShareUrl, shareUrl, type ShareDub } from "../../../utils/share";

const props = defineProps<{
  title: string;
  /** Currently selected valid dubbing project id, or "original". */
  dub?: ShareDub;
  /** Query parameters the page needs to load its entity. */
  keepQuery?: Record<string, string | undefined>;
}>();

const route = useRoute();
const { t } = useI18n();
const siteUrl = useRuntimeConfig().public.siteUrl;

const feedback = ref<string | null>(null);
const manualUrl = ref<string | null>(null);
const manualInput = ref<HTMLInputElement | null>(null);
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

function say(message: string) {
  feedback.value = message;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => (feedback.value = null), 2500);
}

function selectInput() {
  manualInput.value?.select();
}

async function onShare() {
  manualUrl.value = null;
  const url = buildShareUrl({
    siteUrl: typeof siteUrl === "string" ? siteUrl : window.location.origin,
    path: route.path,
    dub: props.dub,
    keepQuery: props.keepQuery,
  });
  const outcome = await shareUrl(props.title, url, {
    share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
    writeText: navigator.clipboard?.writeText
      ? (text) => navigator.clipboard.writeText(text)
      : undefined,
  });
  if (outcome === "copied") say(t("common.shareLinkCopied"));
  else if (outcome === "manual") {
    manualUrl.value = url;
    await nextTick();
    manualInput.value?.focus();
  }
}

onBeforeUnmount(() => clearTimeout(feedbackTimer));
</script>
