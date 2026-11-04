<template>
  <section
    v-if="studio || crew.length > 0"
    class="theme-surface-overlay backdrop-blur border theme-border-subtle theme-border rounded-2xl p-6 space-y-4 mb-10 shadow-xl"
  >
    <h2 class="text-xs font-bold theme-text-muted uppercase tracking-wider">
      {{ title }}
    </h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      <div v-if="studio" class="space-y-1">
        <span class="text-xs theme-text-muted">{{ studioLabel }}</span>
        <NuxtLink
          :to="localePath(`/studio/${studio.id}`)"
          class="text-sm font-semibold theme-primary-text hover:underline block"
        >
          {{ studio.name }}
        </NuxtLink>
      </div>
      <div v-for="member in crew" :key="member.id" class="space-y-1">
        <span class="text-xs theme-text-muted">{{ member.role || $t("common.team") }}</span>
        <NuxtLink
          v-if="member.personId"
          :to="localePath(`/voice-actor/${member.personId}`)"
          class="text-sm font-semibold theme-text hover:underline block"
        >
          {{ member.name }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const localePath = useLocalePath();
withDefaults(
  defineProps<{
    title: string;
    studioLabel: string;
    studio?: { id: number; name?: string | null } | null;
    crew?: {
      id: number;
      role?: string | null;
      personId?: number | null;
      name: string;
    }[];
  }>(),
  { studio: null, crew: () => [] },
);
</script>
