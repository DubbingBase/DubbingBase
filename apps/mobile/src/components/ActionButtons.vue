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
    :disabled="isFetching"
    v-if="hasWikidataId && !hasData && hasPermission('admin_fetch')"
    class="fab-btn"
    @click="handleFetchInfos"
    :aria-label="t('common.fetchInfos')"
  >
    <LoadingSpinner v-if="isFetching" :inline="true"></LoadingSpinner>
    <ion-icon v-else :icon="informationCircleOutline"></ion-icon>
  </ion-button>

  <div v-if="fetchError" class="fetch-error">{{ fetchError }}</div>
</template>

<script setup lang="ts">
import { IonButton, IonIcon } from "@ionic/vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { cameraOutline, informationCircleOutline } from "ionicons/icons";
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
}>();

const emit = defineEmits<{
  "fetch-infos": [];
  "take-photo": [];
}>();

const handleFetchInfos = () => {
  console.log("FAB button clicked, emitting fetch-infos");
  emit("fetch-infos");
};

// Debug logging
console.log("ActionButtons props:", {
  hasWikidataId: props.hasWikidataId,
  hasData: props.hasData,
  isFetching: props.isFetching,
  isScanning: props.isScanning,
  fetchError: props.fetchError,
});
console.log("FAB button should render:", props.hasWikidataId && !props.hasData);
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

.fetch-error {
  color: #ff6666;
  text-align: center;
  margin-top: 16px;
}
</style>
