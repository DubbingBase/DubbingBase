<template>
  <aside
    v-if="showInstallPrompt || needRefresh"
    class="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-violet-500/30 bg-app-surface/95 p-3 shadow-lg shadow-violet-950/10 backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <span
        class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm shadow-violet-950/10"
        aria-hidden="true"
      >
        <svg
          v-if="needRefresh"
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M5.64 9A7 7 0 0 1 17.5 6.5L20 12M4 12l2.5 5.5A7 7 0 0 0 18.36 15" />
        </svg>
        <svg
          v-else
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5" />
          <path d="M12 15V3" />
        </svg>
      </span>

      <div class="min-w-0">
        <p class="text-sm font-semibold text-app-text sm:text-base">
          {{ needRefresh ? t("pwa.updateTitle") : t("pwa.installTitle") }}
        </p>
        <p class="mt-0.5 text-xs text-app-text-muted sm:text-sm">
          {{ needRefresh ? t("pwa.updateDescription") : t("pwa.installDescription") }}
        </p>
      </div>
    </div>

    <div class="flex shrink-0 gap-2">
      <button
        type="button"
        class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm shadow-violet-950/10 transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-offset-2 focus-visible:ring-offset-app-background motion-reduce:transition-none sm:flex-none"
        @click="needRefresh ? refresh() : install()"
      >
        {{ needRefresh ? t("pwa.refresh") : t("pwa.install") }}
      </button>
      <button
        type="button"
        class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-sm font-medium text-app-text-muted transition hover:bg-app-surface-raised hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-offset-2 focus-visible:ring-offset-app-background motion-reduce:transition-none sm:flex-none"
        :aria-label="t('pwa.dismiss')"
        @click="dismiss"
      >
        {{ t("pwa.later") }}
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
const { t } = useI18n();
const { $pwa } = useNuxtApp();

const showInstallPrompt = computed(() => Boolean($pwa?.showInstallPrompt) && !$pwa?.isPWAInstalled);
const needRefresh = computed(() => Boolean($pwa?.needRefresh));

async function install(): Promise<void> {
  await $pwa?.install();
}

async function refresh(): Promise<void> {
  await $pwa?.updateServiceWorker(true);
}

async function dismiss(): Promise<void> {
  if (needRefresh.value) {
    await $pwa?.cancelPrompt();
    return;
  }

  $pwa?.cancelInstall();
}
</script>
