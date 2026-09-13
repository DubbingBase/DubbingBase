<template>
  <div
    class="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
  >
    <div class="mb-6 rounded-full bg-primary/10 p-4">
      <Icon name="lucide:hammer" class="h-12 w-12 text-primary" />
    </div>
    <h1 class="mb-2 text-3xl font-bold tracking-tight">
      {{ $t("common.underConstruction") }}
    </h1>
    <p class="mb-8 max-w-md text-muted-foreground">
      {{ $t("common.underConstructionDescription") }}
    </p>
    <NuxtLink
      :to="localePath('/')"
      class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors theme-focus disabled:pointer-events-none disabled:opacity-50 theme-surface-overlay theme-text theme-hover-surface-muted h-10 px-4 py-2"
      >{{ $t("common.returnHome") }}</NuxtLink
    >
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
</script>
