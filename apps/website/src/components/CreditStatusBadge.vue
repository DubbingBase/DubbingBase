<template>
  <span
    v-if="label"
    class="inline-flex shrink-0 items-center"
    :class="status === 'accepted' ? 'text-app-success-text' : 'text-app-warning-text'"
    :title="label"
    :aria-label="label"
    role="img"
    data-testid="credit-status-badge"
  >
    <BadgeCheckIcon v-if="status === 'accepted'" class="h-3.5 w-3.5" aria-hidden="true" />
    <TriangleAlertIcon v-else class="h-3.5 w-3.5" aria-hidden="true" />
  </span>
</template>

<script setup lang="ts">
import { BadgeCheckIcon, TriangleAlertIcon } from "lucide-vue-next";

// Only 'accepted' (verified) and 'rejected' (disputed) credits get an icon;
// 'waiting', null and undefined render nothing.
const props = defineProps<{ status?: string | null }>();
const { t } = useI18n();

const label = computed(() => {
  if (props.status === "accepted") return t("common.creditVerified");
  if (props.status === "rejected") return t("common.creditDisputed");
  return "";
});
</script>
