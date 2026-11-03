<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-[110] bg-[var(--app-color-backdrop-scrim)] backdrop-blur-sm"
      />
      <DialogContent
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[120] w-[min(400px,calc(100vw-2rem))] theme-surface-overlay border theme-border rounded-2xl p-6 shadow-2xl"
        data-testid="create-voice-actor-dialog"
      >
        <DialogTitle class="text-lg font-bold theme-text mb-4">{{
          $t("projectEditor.createNewVoiceActor")
        }}</DialogTitle>
        <VisuallyHidden
          ><DialogDescription>{{
            $t("projectEditor.formCreateVoiceActor")
          }}</DialogDescription></VisuallyHidden
        >
        <form class="space-y-4" @submit.prevent="submit">
          <label class="block space-y-1">
            <span class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
              $t("projectEditor.firstName")
            }}</span>
            <input
              v-model="firstname"
              type="text"
              required
              class="w-full px-4 py-2 theme-input border theme-border rounded-lg theme-text"
            />
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
              $t("projectEditor.lastName")
            }}</span>
            <input
              v-model="lastname"
              type="text"
              required
              class="w-full px-4 py-2 theme-input border theme-border rounded-lg theme-text"
            />
          </label>
          <p v-if="errorMessage" role="alert" class="text-sm theme-status-danger-text">
            {{ errorMessage }}
          </p>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="min-h-11 px-4 py-2 theme-text-secondary theme-hover-text"
              @click="onOpenChange(false)"
            >
              {{ $t("common.cancel") }}
            </button>
            <button
              type="submit"
              :disabled="!firstname.trim() || !lastname.trim() || isCreating"
              class="min-h-11 px-4 py-2 theme-primary-bg theme-primary-border rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              <Loader2Icon v-if="isCreating" class="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>{{ $t("common.create") }}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
} from "reka-ui";
import { Loader2Icon } from "lucide-vue-next";
import type { AdminLookupOption } from "~/composables/useAdminLookups";
import { formatVoiceActorName } from "~/composables/useAdminLookups";
import {
  isMetadataValidationError,
  type VoiceActorCreationPayload,
} from "~/composables/useMetadataCreation";
import { createStableRequestIdFactory } from "~/utils/dubbing-project-save";

const props = defineProps<{
  open: boolean;
  /** Search text; the first word becomes the first name, the rest the last name. */
  initialQuery: string;
  /** Status sent with the creation payload, when an editor requires one. */
  status?: VoiceActorCreationPayload["status"];
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "created", voiceActor: AdminLookupOption): void;
}>();

const { t } = useI18n();
const firstname = ref("");
const lastname = ref("");
const isCreating = ref(false);
const errorMessage = ref<string | null>(null);
// Retrying the same payload reuses its request id, so a lost response cannot create duplicates.
const requestIds = createStableRequestIdFactory();

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    const parts = props.initialQuery.trim().split(/\s+/);
    firstname.value = parts[0] || "";
    lastname.value = parts.slice(1).join(" ");
    errorMessage.value = null;
  },
  { immediate: true },
);

const onOpenChange = (open: boolean) => {
  if (!open && isCreating.value) return;
  if (!open) requestIds.clear();
  emit("update:open", open);
};

const submit = async () => {
  const payload: VoiceActorCreationPayload = {
    firstname: firstname.value.trim(),
    lastname: lastname.value.trim(),
    ...(props.status ? { status: props.status } : {}),
  };
  if (!payload.firstname || !payload.lastname) {
    errorMessage.value = t("projectEditor.voiceActorNameRequired");
    return;
  }

  isCreating.value = true;
  errorMessage.value = null;
  try {
    const { data } = await useMetadataCreation().createVoiceActor(
      payload,
      requestIds.forPayload(payload),
    );
    requestIds.clear();
    emit("created", { id: data.id, name: formatVoiceActorName(data) });
    emit("update:open", false);
  } catch (error: unknown) {
    // Keep the dialog and typed names so the user can retry with the same request id.
    errorMessage.value = isMetadataValidationError(error)
      ? t("projectEditor.voiceActorInvalid")
      : t("projectEditor.createVoiceActorFailed");
  } finally {
    isCreating.value = false;
  }
};
</script>
