<template>
  <div
    class="admin-project-editor mx-auto max-w-7xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-8"
    :inert="form.isSaving.value"
    :aria-busy="form.isSaving.value"
  >
    <AdminEditorHero
      :title="title"
      :eyebrow="eyebrow"
      :poster-url="posterUrl"
      :back-to="backTo"
      :back-label="backLabel.replace(/^←\s*/, '')"
      :chips="chips"
    >
      <!-- Language switcher: one chip per dubbing project of this work -->
      <nav
        v-if="projectsBasePath"
        class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5"
        :aria-label="$t('projectEditor.dubbingLanguage')"
      >
        <AppFilterChip
          v-for="project in projects"
          :key="project.id"
          :to="localePath(`${projectsBasePath}/projects/${project.id}/edit`)"
          :selected="project.id === Number(projectIdParam)"
          size="md"
        >
          {{ languageLabel(project.language) }}
          <span v-if="project.studios?.name" class="text-xs opacity-75">{{
            project.studios.name
          }}</span>
        </AppFilterChip>
        <AppFilterChip
          :to="localePath(`${projectsBasePath}/projects/new`)"
          :selected="projectIdParam === 'new'"
          dashed
          size="md"
        >
          <PlusIcon class="h-4 w-4" aria-hidden="true" />
          {{ $t("projectEditor.addLanguage").replace(/^\+\s*/, "") }}
        </AppFilterChip>
      </nav>
    </AdminEditorHero>

    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center gap-4 py-24 theme-text-muted"
    >
      <Loader2Icon class="h-8 w-8 animate-spin theme-status-info-text" />
      <span class="text-sm">{{ $t("projectEditor.loadingData") }}</span>
    </div>

    <div
      v-else-if="loadError"
      role="alert"
      class="rounded-xl border border-[var(--app-color-danger-border)] theme-status-danger p-6 text-sm theme-status-danger-text"
    >
      {{ loadError }}
    </div>

    <template v-else>
      <AdminEditorTabs
        v-model="section"
        :items="sections"
        :nav-label="$t('projectEditor.sectionNav')"
      />

      <!-- Sections stay mounted (v-show) so unsaved edits are never lost when switching. -->
      <form
        :id="formId"
        novalidate
        class="min-w-0 space-y-4 sm:space-y-6"
        @submit.prevent="emit('submit')"
      >
        <!-- Cast first: the main job of this editor is assigning voices -->
        <div v-show="section === 'cast'"><slot name="cast" /></div>
        <div v-show="section === 'overview'" class="space-y-4 sm:space-y-6">
          <slot name="overview" />
        </div>
        <div v-show="section === 'crew'" class="space-y-4 sm:space-y-6"><slot name="crew" /></div>
        <div v-show="section === 'settings'" class="space-y-4 sm:space-y-6">
          <slot name="settings" />
        </div>
      </form>
    </template>

    <!-- Dialogs, toasts and other overlays owned by the editor -->
    <slot />

    <AdminEditorSaveBar
      v-if="!isLoading && !loadError"
      :status="form.status.value"
      :is-dirty="form.isDirty.value"
      :error-message="form.errorMessage.value"
      :save-label="saveLabel"
      :form-id="formId"
      @discard="form.discard"
    />
    <AdminUnsavedChangesDialog
      :open="form.isLeavePromptOpen.value"
      @stay="form.stayOnPage"
      @discard="form.discardAndLeave"
    />
  </div>
</template>

<script setup lang="ts">
import { Loader2Icon, PlusIcon } from "lucide-vue-next";
import { computed } from "vue";
import type { useEditorFormState } from "~/composables/useEditorFormState";
import type { EditorProjectTab } from "~/utils/admin-project-editor-types";

export type EditorSection = "overview" | "cast" | "crew" | "settings";

/**
 * Page layout shared by every project editor: hero, language switcher, section tabs,
 * save bar and leave guard. Editors only fill the section slots.
 */
const props = defineProps<{
  title: string;
  eyebrow: string;
  backTo: string;
  backLabel: string;
  posterUrl?: string;
  chips?: string[];
  /** Base path of the work (e.g. `/movie/12`); the language switcher is hidden when absent. */
  projectsBasePath: string | null;
  projects: EditorProjectTab[];
  /** Route param of the open project: an id, or `new`. */
  projectIdParam?: string;
  languageLabel: (language: string | null | undefined) => string;
  formId: string;
  saveLabel: string;
  form: ReturnType<typeof useEditorFormState>;
  isLoading: boolean;
  loadError?: string | null;
  castCount: number;
  /** Section tabs to show; defaults to all four. */
  hiddenSections?: EditorSection[];
}>();
const emit = defineEmits<{ submit: [] }>();
const section = defineModel<EditorSection>("section", { default: "cast" });

const { t } = useI18n();
const localePath = useLocalePath();

type SectionItem = { id: EditorSection; label: string; count: number | null };
const sections = computed<SectionItem[]>(() => {
  const all: SectionItem[] = [
    { id: "cast", label: t("projectEditor.sectionCast"), count: props.castCount },
    { id: "overview", label: t("projectEditor.sectionOverview"), count: null },
    { id: "crew", label: t("projectEditor.sectionCrew"), count: null },
    { id: "settings", label: t("projectEditor.sectionSettings"), count: null },
  ];
  return all.filter((item) => !props.hiddenSections?.includes(item.id));
});
</script>
