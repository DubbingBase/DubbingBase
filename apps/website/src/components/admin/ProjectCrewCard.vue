<template>
  <AdminFormCard :title="title" :description="description">
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
      <AdminFormField :label="studioLabel">
        <AdminAsyncAutocomplete
          v-model="studioId"
          :options="studioOptions"
          :search-fn="lookups.searchStudios"
          :placeholder="$t('projectEditor.searchStudio')"
          :allow-create="true"
          :display-fn="lookups.studioLabel"
          @create="(query: string) => emit('createStudio', query, (id: number) => (studioId = id))"
        />
      </AdminFormField>

      <AdminFormField v-for="field in fields" :key="field.key" :label="field.label">
        <AdminAsyncAutocomplete
          :model-value="crew[field.key] ?? null"
          :options="voiceActorOptions"
          :search-fn="lookups.searchVoiceActors"
          :placeholder="$t('projectEditor.searchVoiceActor')"
          :allow-create="true"
          :display-fn="lookups.voiceActorLabel"
          @update:model-value="
            (value: string | number | null) =>
              emit('update:crew', field.key, typeof value === 'number' ? value : null)
          "
          @create="
            (query: string) =>
              emit('createVoiceActor', query, (id: number) => emit('update:crew', field.key, id))
          "
        />
      </AdminFormField>
    </div>
  </AdminFormCard>
</template>

<script setup lang="ts">
import type { AdminLookupOption, AdminLookups } from "~/composables/useAdminLookups";

export interface CrewFieldDefinition {
  key: string;
  label: string;
}

/** Studio plus crew pickers, shared by every project editor. */
defineProps<{
  title: string;
  description?: string;
  studioLabel: string;
  fields: CrewFieldDefinition[];
  /** Current crew member (voice actor id) per field key. */
  crew: Record<string, number | null>;
  studioOptions: AdminLookupOption[];
  voiceActorOptions: AdminLookupOption[];
  lookups: AdminLookups;
}>();
const emit = defineEmits<{
  "update:crew": [key: string, value: number | null];
  createStudio: [query: string, apply: (id: number) => void];
  createVoiceActor: [query: string, apply: (id: number) => void];
}>();
const studioId = defineModel<number | null>("studioId", { required: true });
</script>
