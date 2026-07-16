<template>
  <ion-button
    :disabled="isScanning"
    v-if="hasWikidataId && !hasData && isScannerEnabled"
    class="scan-fab-btn"
    @click="$emit('take-photo')"
    :aria-label="t('common.scan')"
  >
    <LoadingSpinner v-if="isScanning" :inline="true"></LoadingSpinner>
    <ion-icon v-else :icon="cameraOutline"></ion-icon>
  </ion-button>

  <ion-button
    :disabled="isFetching || queueStatus === 'pending' || queueStatus === 'processing'"
    v-if="hasWikidataId && !hasData"
    class="enqueue-fab-btn"
    @click="handleEnqueue"
    :aria-label="t('common.enqueue')"
  >
    <ion-icon slot="icon-only" :icon="listOutline"></ion-icon>
  </ion-button>

  <ion-button
    :disabled="isFetching || queueStatus === 'pending' || queueStatus === 'processing'"
    v-if="hasWikidataId && !hasData"
    class="fab-btn"
    @click="handleFetchInfos"
    :aria-label="t('common.fetchInfos')"
  >
    <LoadingSpinner v-if="isFetching || queueStatus === 'pending' || queueStatus === 'processing'" :inline="true"></LoadingSpinner>
    <ion-icon slot="icon-only" v-else :icon="informationCircleOutline"></ion-icon>
  </ion-button>

  <div v-if="fetchError || (queueStatus === 'failed' && queueErrorMessage)" class="fetch-error">
    {{ fetchError || queueErrorMessage }}
  </div>
</template>

<script setup lang="ts">
import { IonButton, IonIcon } from "@ionic/vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { cameraOutline, informationCircleOutline, listOutline } from "ionicons/icons";
import { useI18n } from "vue-i18n";
import { usePermissions } from "@/composables/usePermissions";
import { computed } from "vue";

const { t } = useI18n();
const { hasPermission } = usePermissions();

const isScannerEnabled = computed(() => hasPermission("ai-scanner"));

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
console.log("ActionButtons props:", {
  hasWikidataId: props.hasWikidataId,
  hasData: props.hasData,
  isFetching: props.isFetching,
  isScanning: props.isScanning,
  fetchError: props.fetchError,
  queueStatus: props.queueStatus,
  queueErrorMessage: props.queueErrorMessage,
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
