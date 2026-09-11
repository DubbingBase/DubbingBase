<template>
  <aside
    v-if="showInstallPrompt || needRefresh"
    class="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur-xl"
    aria-live="polite"
  >
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold text-foreground">
        {{ needRefresh ? t("pwa.updateTitle") : t("pwa.installTitle") }}
      </p>
      <p class="mt-0.5 text-xs text-muted-foreground">
        {{
          needRefresh ? t("pwa.updateDescription") : t("pwa.installDescription")
        }}
      </p>
    </div>

    <button
      v-if="needRefresh"
      type="button"
      class="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      @click="refresh"
    >
      {{ t("pwa.refresh") }}
    </button>
    <button
      v-else
      type="button"
      class="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      @click="install"
    >
      {{ t("pwa.install") }}
    </button>
    <button
      type="button"
      class="inline-flex h-9 shrink-0 items-center rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :aria-label="t('pwa.dismiss')"
      @click="dismiss"
    >
      {{ t("pwa.later") }}
    </button>
  </aside>
</template>

<script setup lang="ts">
const { t } = useI18n();
const { $pwa } = useNuxtApp();

const showInstallPrompt = computed(
  () => Boolean($pwa?.showInstallPrompt) && !$pwa?.isPWAInstalled,
);
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
