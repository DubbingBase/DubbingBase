<template>
  <div
    v-if="showBanner"
    class="bg-blue-600 text-white text-center py-2 px-4 flex justify-between items-center text-sm z-50 relative"
  >
    <div class="flex-1 text-center">
      {{ $t("language.suggestSwitch") }}
      <button @click="switchToPreferred" class="underline font-semibold ml-2 hover:text-blue-200">
        {{ $t("language.switchNow") }}
      </button>
    </div>
    <button @click="dismiss" class="text-white hover:text-blue-200 p-1" aria-label="Dismiss">
      <XIcon class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { XIcon } from "lucide-vue-next";
import type { SupportedLocale } from "@app/shared-logic";

const { locale } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const { getPreferredLocale, rememberLocale } = useLocalePreference();
const preferredLocale = ref<SupportedLocale | null>(null);
const showBanner = ref(false);

onMounted(() => {
  // Suggest only (never redirect): the server HTML is identical for everyone.
  const preferred = getPreferredLocale();
  if (preferred && preferred !== locale.value && !sessionStorage.getItem("lang_banner_dismissed")) {
    preferredLocale.value = preferred;
    showBanner.value = true;
  }
});

const switchToPreferred = () => {
  if (preferredLocale.value) {
    const lang = preferredLocale.value;
    rememberLocale(lang);
    navigateTo(switchLocalePath(lang));
    showBanner.value = false;
  }
};

const dismiss = () => {
  showBanner.value = false;
  sessionStorage.setItem("lang_banner_dismissed", "true");
};
</script>
