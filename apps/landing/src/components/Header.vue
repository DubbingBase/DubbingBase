<template>
  <header class="flex justify-between items-center mb-12 py-6 px-6 border-b border-gray-800">
    <router-link to="/" class="text-3xl font-extrabold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
      {{ t('app.title') }}
    </router-link>

    <nav class="flex items-center gap-4">
      <router-link to="/" class="text-gray-300 hover:text-white transition text-sm">{{ t('nav.home') }}</router-link>

      <button
        @click="handleLogin"
        class="flex items-center gap-1.5 text-gray-300 hover:text-white transition text-sm"
        :aria-label="t('nav.login')"
      >
        <UserIcon class="w-4 h-4" />
        <span>{{ t('nav.login') }}</span>
      </button>

      <button
        @click="handleApiKey"
        class="flex items-center gap-1.5 text-gray-300 hover:text-white transition text-sm"
        :aria-label="t('nav.apiKey')"
      >
        <KeyIcon class="w-4 h-4" />
        <span>{{ t('nav.apiKey') }}</span>
      </button>

      <SelectRoot v-model="theme">
        <SelectTrigger class="flex items-center gap-1.5 text-gray-300 hover:text-white transition text-sm bg-transparent border-none cursor-pointer">
          <SunIcon v-if="theme === 'light'" class="w-4 h-4" />
          <MoonIcon v-else-if="theme === 'dark'" class="w-4 h-4" />
          <MonitorIcon v-else class="w-4 h-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">
            <div class="flex items-center gap-2">
              <SunIcon class="w-4 h-4" />
              <span>{{ t('theme.light') }}</span>
            </div>
          </SelectItem>
          <SelectItem value="dark">
            <div class="flex items-center gap-2">
              <MoonIcon class="w-4 h-4" />
              <span>{{ t('theme.dark') }}</span>
            </div>
          </SelectItem>
          <SelectItem value="system">
            <div class="flex items-center gap-2">
              <MonitorIcon class="w-4 h-4" />
              <span>{{ t('theme.system') }}</span>
            </div>
          </SelectItem>
        </SelectContent>
      </SelectRoot>

      <SelectRoot v-model="locale">
        <SelectTrigger class="flex items-center gap-1.5 text-gray-300 hover:text-white transition text-sm bg-transparent border-none cursor-pointer">
          <GlobeIcon class="w-4 h-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{{ t('language.en') }}</SelectItem>
          <SelectItem value="fr">{{ t('language.fr') }}</SelectItem>
        </SelectContent>
      </SelectRoot>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { useTheme } from '../composables/useTheme';
import { useI18n } from '../composables/useI18n';
import { SunIcon, MoonIcon, UserIcon, KeyIcon, GlobeIcon, MonitorIcon } from 'lucide-vue-next';
import {
  SelectRoot,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from 'reka-ui';

const { theme } = useTheme();
const { t, locale } = useI18n();

const handleLogin = () => {
  alert(t('login.message'));
};

const handleApiKey = () => {
  alert(t('apiKey.message'));
};
</script>