<template>
  <div class="space-y-5">
    <AdminCastVoiceActorField
      v-model="voiceActorId"
      :options="voiceActorOptions"
      :lookups="lookups"
      @create="(query: string) => emit('createVoiceActor', query)"
    />
    <div class="grid gap-5 sm:grid-cols-2">
      <AdminFormField :label="roleLabel" for-id="cast-detail-role">
        <input
          id="cast-detail-role"
          v-model="characterName"
          type="text"
          class="h-11 w-full rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)]"
        />
      </AdminFormField>
      <AdminFormField :label="$t('projectEditor.performanceType')" for-id="cast-detail-performance">
        <input
          id="cast-detail-performance"
          v-model="performance"
          type="text"
          class="h-11 w-full rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)]"
        />
      </AdminFormField>
    </div>
    <AdminFormField :label="$t('projectEditor.castNote')" for-id="cast-detail-note">
      <input
        id="cast-detail-note"
        v-model="note"
        type="text"
        enterkeyhint="done"
        class="h-11 w-full rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)]"
      />
    </AdminFormField>
  </div>
</template>

<script setup lang="ts">
import type { AdminLookupOption, AdminLookups } from "~/composables/useAdminLookups";

/** Detail panel of the cast workspace for media with a role and a voice only (no original cast). */
defineProps<{
  voiceActorOptions: AdminLookupOption[];
  lookups: AdminLookups;
  roleLabel: string;
}>();
const emit = defineEmits<{ createVoiceActor: [query: string] }>();
const voiceActorId = defineModel<number | null>("voiceActorId", { required: true });
const characterName = defineModel<string>("characterName", { required: true });
const performance = defineModel<string>("performance", { required: true });
const note = defineModel<string>("note", { required: true });
</script>
