<template>
  <AppButton
    :disabled="isScanning"
    v-if="!hasData && isScannerEnabled"
    class="scan-fab-btn"
    @click="$emit('take-photo')"
    :aria-label="t('common.scan')"
  >
    <LoadingSpinner v-if="isScanning" :inline="true"></LoadingSpinner>
    <Camera class="app-icon" />
  </AppButton>

  <AppButton
    :disabled="isFetching || queueStatus === 'pending' || queueStatus === 'processing'"
    v-if="hasWikidataId && !hasData"
    class="enqueue-fab-btn"
    @click="handleEnqueue"
    :aria-label="t('common.enqueue')"
  >
    <List class="app-icon" />
  </AppButton>

  <AppButton
    :disabled="isFetching || queueStatus === 'pending' || queueStatus === 'processing'"
    v-if="hasWikidataId && !hasData"
    class="fab-btn"
    @click="handleFetchInfos"
    :aria-label="t('common.fetchInfos')"
  >
    <LoadingSpinner v-if="isFetching || queueStatus === 'pending' || queueStatus === 'processing'" :inline="true"></LoadingSpinner>
    <Info class="app-icon" />
  </AppButton>

  <div v-if="fetchError || (queueStatus === 'failed' && queueErrorMessage)" class="fetch-error">
    {{ fetchError || queueErrorMessage }}
  </div>
</template>

<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue';
import Camera from '~icons/lucide/camera';
import List from '~icons/lucide/list';
import Info from '~icons/lucide/info';

import LoadingSpinner from "@/components/common/LoadingSpinner.vue";

import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/auth";
import { watchEffect } from "vue";
import { storeToRefs } from "pinia";

const { t } = useI18n();
const authStore = useAuthStore();
const { isAdmin } = storeToRefs(authStore);

const isScannerEnabled = isAdmin;

const props = defineProps<{
  hasWikidataId: boolean;
  hasData: boolean;
  isFetching: boolean;
  isScanning: boolean;
  fetchError?: string;
  queueStatus?: string | null;
  queueErrorMessage?: string | null;
}>();

const emit = defineEmits<{
  "fetch-infos": [];
  "enqueue": [];
  "take-photo": [];
}>();

const handleFetchInfos = () => {
  console.log("FAB button clicked, emitting fetch-infos");
  emit("fetch-infos");
};

const handleEnqueue = () => {
  console.log("Enqueue FAB button clicked, emitting enqueue");
  emit("enqueue");
};

// Debug logging
watchEffect(() => {
  console.log("ActionButtons state:", {
    hasWikidataId: props.hasWikidataId,
    hasData: props.hasData,
    isScannerEnabled: isScannerEnabled.value,
    isScanning: props.isScanning,
    isFetching: props.isFetching,
    queueStatus: props.queueStatus,
    scannerButtonVisible: !props.hasData && isScannerEnabled.value
  });
});
</script>

<style scoped lang="scss">
.scan-fab-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  --border-radius: 50%;
  width: 56px;
  height: 56px;
  --background: var(--ion-color-secondary);
  --color: white;
  --box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.fab-btn {
  position: fixed;
  bottom: 84px;
  right: 20px;
  z-index: 1000;
  --border-radius: 50%;
  width: 56px;
  height: 56px;
  --background: var(--ion-color-primary);
  --color: white;
  --box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.enqueue-fab-btn {
  position: fixed;
  bottom: 148px;
  right: 20px;
  z-index: 1000;
  --border-radius: 50%;
  width: 56px;
  height: 56px;
  --background: var(--ion-color-tertiary, #9c27b0);
  --color: white;
  --box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.fetch-error {
  color: #ff6666;
  text-align: center;
  margin-top: 16px;
}
</style>
