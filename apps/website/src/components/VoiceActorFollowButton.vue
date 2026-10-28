<template>
  <div v-if="user" class="flex flex-col items-start gap-3">
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-lg border theme-border px-3 py-2 text-sm font-medium theme-text theme-hover-surface-muted disabled:opacity-60"
      :disabled="loading"
      :aria-pressed="subscribed"
      @click="toggleFollow"
    >
      <BellIcon v-if="!subscribed" class="h-4 w-4" />
      <BellOffIcon v-else class="h-4 w-4" />
      {{ subscribed ? t("push.unfollow") : t("push.follow") }}
    </button>

    <section
      v-if="showOffer"
      class="max-w-sm rounded-xl border theme-border-subtle theme-surface-raised p-4"
      aria-live="polite"
    >
      <p class="text-sm font-semibold theme-text">{{ t("push.offerTitle") }}</p>
      <p class="mt-1 text-sm theme-text-muted">{{ t("push.offerDescription") }}</p>
      <p v-if="message" class="mt-2 text-sm theme-text-muted">{{ message }}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          :disabled="loading"
          @click="enablePush"
        >
          {{ t("push.enable") }}
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm theme-text-muted theme-hover-text"
          @click="showOffer = false"
        >
          {{ t("push.notNow") }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { BellIcon, BellOffIcon } from "lucide-vue-next";
import { enablePushNotifications } from "../composables/usePushNotifications";

const props = defineProps<{ voiceActorId: number }>();
const { t } = useI18n();
const user = useSupabaseUser();
const subscribed = ref(false);
const loading = ref(false);
const showOffer = ref(false);
const message = ref("");

async function loadState(): Promise<void> {
  if (!user.value) return;
  try {
    const response = await $fetch<{
      subscriptions: Array<{ voice_actor_id: number }>;
    }>("/api/manage-subscription", { method: "POST", body: { action: "list" } });
    subscribed.value = response.subscriptions.some(
      (subscription) => subscription.voice_actor_id === props.voiceActorId,
    );
  } catch {
    subscribed.value = false;
  }
}

async function toggleFollow(): Promise<void> {
  if (!user.value || loading.value) return;
  loading.value = true;
  message.value = "";
  try {
    const action = subscribed.value ? "unsubscribe" : "subscribe";
    await $fetch("/api/manage-subscription", {
      method: "POST",
      body: { action, voice_actor_id: props.voiceActorId },
    });
    subscribed.value = !subscribed.value;
    if (subscribed.value && user.value) {
      const offerKey = `dubbingbase.push-offer-seen:${user.value.id}`;
      try {
        if (!localStorage.getItem(offerKey)) {
          localStorage.setItem(offerKey, "true");
          showOffer.value = true;
        }
      } catch {
        showOffer.value = true;
      }
    }
  } catch {
    message.value = t("push.followFailed");
  } finally {
    loading.value = false;
  }
}

async function enablePush(): Promise<void> {
  loading.value = true;
  const result = await enablePushNotifications();
  if (result.ok) {
    showOffer.value = false;
  } else if (result.reason === "install-required") {
    message.value = t("push.installGuidance");
  } else if (result.reason === "denied") {
    message.value = t("push.deniedGuidance");
  } else if (result.reason === "unsupported") {
    message.value = t("push.unsupported");
  } else {
    message.value = t("push.enableFailed");
  }
  loading.value = false;
}

watch(
  () => [user.value?.id, props.voiceActorId],
  () => void loadState(),
  { immediate: true },
);
</script>
