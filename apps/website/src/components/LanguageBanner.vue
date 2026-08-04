<template>
  <div v-if="showBanner" class="bg-blue-600 text-white text-center py-2 px-4 flex justify-between items-center text-sm z-50 relative">
    <div class="flex-1 text-center">
      {{ $t('language.suggestSwitch') }}
      <button @click="switchToPreferred" class="underline font-semibold ml-2 hover:text-blue-200">
        {{ $t('language.switchNow') }}
      </button>
    </div>
    <button @click="dismiss" class="text-white hover:text-blue-200 p-1" aria-label="Dismiss">
      <XIcon class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { XIcon } from 'lucide-vue-next';


const { locale } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const userLangCookie = useCookie('user_lang');
const showBanner = ref(false);

onMounted(() => {
  // Only show the banner if the user explicitly has a cookie AND it mismatches the current URL language
  if (userLangCookie.value && userLangCookie.value !== locale.value) {
    const dismissed = sessionStorage.getItem('lang_banner_dismissed');
    if (!dismissed) {
      showBanner.value = true;
    }
  }
});

const switchToPreferred = () => {
  if (userLangCookie.value) {
    const lang: string = userLangCookie.value;
    navigateTo(switchLocalePath(lang));
    showBanner.value = false;
  }
};

const dismiss = () => {
  showBanner.value = false;
  sessionStorage.setItem('lang_banner_dismissed', 'true');
};
</script>
