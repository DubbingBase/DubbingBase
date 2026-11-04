<template>
  <div v-if="projects.length > 0 || original" class="flex flex-wrap gap-2">
    <NuxtLink v-if="original" :to="tabTarget('original')" :class="tabClass(original.active)">
      {{ $t("details.originalVersion") }}
      <span :class="countClass(original.active)">{{ original.count }}</span>
    </NuxtLink>
    <NuxtLink
      v-for="project in projects"
      :key="project.id"
      :to="tabTarget(project.id)"
      :class="tabClass(activeId === project.id)"
    >
      {{ languageLabel(project.language) }}
      <span v-if="count" :class="countClass(activeId === project.id)">{{ count(project) }}</span>
    </NuxtLink>
  </div>
  <div v-else class="text-sm theme-text-muted font-medium">
    {{ $t("details.noDubbingProjects") }}
  </div>
</template>

<script setup lang="ts" generic="P extends { id: number; language?: string | null }">
const props = defineProps<{
  projects: P[];
  activeId: number;
  languageLabel: (code: string | undefined | null) => string;
  count?: (project: P) => number;
  /** Optional "original version" tab (movies and shows). */
  original?: { active: boolean; count: number } | null;
  /** Link to another route (e.g. the episode page) instead of the current one. */
  path?: string;
}>();

function tabTarget(dub: number | "original") {
  return props.path ? { path: props.path, query: { dub } } : { query: { dub } };
}

function tabClass(active: boolean): string[] {
  return [
    "px-4 py-2 rounded-lg text-sm font-medium transition-colors border theme-border-subtle theme-border flex items-center gap-1.5",
    active
      ? "theme-primary-bg theme-primary-border"
      : "theme-surface theme-text-secondary theme-hover-surface-muted",
  ];
}

function countClass(active: boolean): string[] {
  return [
    "text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors",
    active ? "bg-black/15 text-black" : "theme-surface-raised theme-surface-muted theme-text-muted",
  ];
}
</script>
