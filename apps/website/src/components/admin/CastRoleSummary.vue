<template>
  <div class="flex items-center gap-4" data-testid="cast-detail-portraits">
    <AdminCastAvatar :name="row.characterName" :src="row.characterImage" large />
    <div class="min-w-0 flex-1 space-y-2">
      <p class="truncate text-lg font-bold leading-tight theme-text">
        {{ row.characterName || $t("projectEditor.castUnknownCharacter") }}
      </p>
      <p class="flex min-w-0 items-center gap-2 text-xs theme-text-muted">
        <AdminCastAvatar
          :name="row.originalActorName"
          :src="row.originalActorImage"
          class="!h-6 !w-6 !text-[10px]"
        />
        <span class="truncate">
          {{ row.originalActorName || $t("projectEditor.castOriginalActor") }}
        </span>
      </p>
      <p class="flex min-w-0 items-center gap-2 text-xs font-semibold theme-text-secondary">
        <AdminCastAvatar
          :name="row.voiceActorName"
          :src="row.voiceActorImage"
          class="!h-6 !w-6 !text-[10px]"
        />
        <span class="truncate">
          {{ row.voiceActorName || $t("projectEditor.castUnassigned") }}
        </span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CastWorkspaceRow } from "~/utils/cast-workspace";

defineProps<{ row: CastWorkspaceRow }>();
</script>
