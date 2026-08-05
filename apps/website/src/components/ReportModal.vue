<template>
  <DialogRoot v-model:open="isOpen">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" />
      <DialogContent class="fixed top-[20%] left-1/2 -translate-x-1/2 w-[90vw] max-w-md z-50 bg-[#1d1d1d] border border-[#2a2a2a] rounded-2xl shadow-2xl p-6 overflow-hidden focus:outline-none flex flex-col">
        <DialogTitle class="text-xl font-bold text-white mb-2">{{ t('report.title', 'Signaler cette fiche') }}</DialogTitle>
        <DialogDescription class="text-gray-400 text-sm mb-4">
          {{ t('report.description', 'Veuillez sélectionner la raison de votre signalement.') }}
        </DialogDescription>

        <form @submit.prevent="submit" class="flex flex-col gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="reason">{{ t('report.reason', 'Raison') }}</label>
            <select
              id="reason"
              v-model="reason"
              required
              class="w-full bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="" disabled>{{ t('report.selectReason', 'Sélectionnez une raison...') }}</option>
              <option value="copyright">{{ t('report.reasons.copyright', 'Atteinte aux droits d\'auteur') }}</option>
              <option value="inappropriate">{{ t('report.reasons.inappropriate', 'Contenu inapproprié ou illicite') }}</option>
              <option value="error">{{ t('report.reasons.error', 'Erreur manifeste dans les données') }}</option>
              <option value="other">{{ t('report.reasons.other', 'Autre') }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="details">{{ t('report.details', 'Détails') }}</label>
            <textarea
              id="details"
              v-model="details"
              rows="3"
              class="w-full bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 resize-none"
              :placeholder="t('report.detailsPlaceholder', 'Veuillez préciser le problème...')"
            ></textarea>
          </div>

          <div v-if="error" class="text-red-500 text-sm">
            {{ error }}
          </div>

          <div v-if="success" class="text-green-500 text-sm">
            {{ t('report.successMessage', 'Merci, votre signalement a été envoyé.') }}
          </div>

          <div class="flex justify-end gap-3 mt-4">
            <button
              type="button"
              @click="isOpen = false"
              class="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition"
              :disabled="isSubmitting"
            >
              {{ t('common.cancel', 'Annuler') }}
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              :disabled="isSubmitting || !reason"
            >
              <Loader2Icon v-if="isSubmitting" class="w-4 h-4 animate-spin" />
              {{ t('common.submit', 'Envoyer') }}
            </button>
          </div>
        </form>

      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { 
  DialogRoot, 
  DialogPortal, 
  DialogOverlay, 
  DialogContent,
  DialogTitle,
  DialogDescription
} from 'reka-ui';
import { Loader2Icon } from 'lucide-vue-next';
import { useReports } from '../composables/useReports';

const props = defineProps<{
  open: boolean;
  targetUrl: string;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const { t } = useI18n();
const { submitReport, isSubmitting, error } = useReports();

const isOpen = ref(props.open);
const reason = ref('');
const details = ref('');
const success = ref(false);

watch(() => props.open, (val) => { isOpen.value = val; });
watch(isOpen, (val) => { 
  emit('update:open', val); 
  if (!val) {
    // Reset form when closed
    setTimeout(() => {
      reason.value = '';
      details.value = '';
      error.value = null;
      success.value = false;
    }, 200);
  }
});

const submit = async () => {
  success.value = false;
  if (!reason.value) return;

  const result = await submitReport(props.targetUrl, reason.value, details.value);
  if (result) {
    success.value = true;
    setTimeout(() => {
      isOpen.value = false;
    }, 2000);
  }
};
</script>
