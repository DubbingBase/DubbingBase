<template>
  <AdminFormField :label="$t('projectEditor.voiceActor')">
    <AdminAsyncAutocomplete
      v-model="voiceActorId"
      :options="options"
      :search-fn="lookups.searchVoiceActors"
      :placeholder="$t('projectEditor.searchVoiceActor')"
      :allow-create="true"
      :display-fn="lookups.voiceActorLabel"
      @create="(query: string) => emit('create', query)"
    >
      <template #leading>
        <AdminCastAvatar
          size="xs"
          :name="voiceActorId ? lookups.voiceActorLabel(voiceActorId) : ''"
          :src="lookups.voiceActorImage(voiceActorId)"
        />
      </template>
      <template #option="{ option }"
        ><span class="flex items-center gap-2"
          ><AdminCastAvatar size="sm" :name="option.name" :src="option.image ?? null" />{{
            option.name
          }}</span
        ></template
      >
    </AdminAsyncAutocomplete>
  </AdminFormField>
</template>

<script setup lang="ts">
import type { AdminLookupOption, AdminLookups } from "~/composables/useAdminLookups";

/** Voice-actor picker with portraits, shared by every cast editor. */
defineProps<{ options: AdminLookupOption[]; lookups: AdminLookups }>();
const emit = defineEmits<{ create: [query: string] }>();
const voiceActorId = defineModel<number | null>({ required: true });
</script>
