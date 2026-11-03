<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-[110] bg-[var(--app-color-backdrop-scrim)] backdrop-blur-sm"
      />
      <DialogContent
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[120] w-[min(400px,calc(100vw-2rem))] theme-surface-overlay border theme-border rounded-2xl p-6 shadow-2xl"
        data-testid="create-studio-dialog"
      >
        <DialogTitle class="text-lg font-bold theme-text mb-4">{{
          $t("projectEditor.createNewStudio")
        }}</DialogTitle>
        <VisuallyHidden
          ><DialogDescription>{{
            $t("projectEditor.formCreateStudio")
          }}</DialogDescription></VisuallyHidden
        >
        <form class="space-y-4" @submit.prevent="submit">
          <label class="block space-y-1">
            <span class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
              $t("projectEditor.studioName")
            }}</span>
            <input
              v-model="name"
              type="text"
              required
              class="w-full px-4 py-2 theme-input border theme-border rounded-lg theme-text"
              :aria-invalid="!!errorMessage"
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
              :disabled="!name.trim() || isCreating"
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

const props = defineProps<{
  open: boolean;
  initialName: string;
  create: (name: string) => Promise<AdminLookupOption>;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "created", studio: AdminLookupOption): void;
}>();

const { t } = useI18n();
const name = ref("");
const isCreating = ref(false);
const errorMessage = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    name.value = props.initialName.trim();
    errorMessage.value = null;
  },
  { immediate: true },
);

const onOpenChange = (open: boolean) => {
  if (!open && isCreating.value) return;
  emit("update:open", open);
};

const submit = async () => {
  const studioName = name.value.trim();
  if (!studioName) {
    errorMessage.value = t("projectEditor.studioNameRequired");
    return;
  }
  isCreating.value = true;
  errorMessage.value = null;
  try {
    const studio = await props.create(studioName);
    emit("created", studio);
    emit("update:open", false);
  } catch {
    // Keep the dialog and typed name so the user can retry.
    errorMessage.value = t("projectEditor.createStudioFailed");
  } finally {
    isCreating.value = false;
  }
};
</script>
