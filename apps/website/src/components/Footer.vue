<template>
  <footer class="mt-20 border-t border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#121212] pt-16 pb-8 text-gray-500 dark:text-gray-400">
    <div class="max-w-7xl mx-auto px-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <!-- Brand -->
        <div class="col-span-1 md:col-span-1">
          <NuxtLink :to="$localePath('/')" class="text-2xl font-extrabold text-gray-900 dark:text-white inline-block mb-4">
            {{ t('app.title') }}
          </NuxtLink>
          <p class="text-sm text-gray-500 mb-6 leading-relaxed">
            {{ t('app.description') }}
          </p>
          <div class="flex items-center gap-4">
            <a href="https://x.com/DubbingBase" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-gray-900 dark:text-white transition">
              <TwitterIcon class="w-5 h-5" />
            </a>
            <a href="https://instagram.com/dubbingbase" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-gray-900 dark:text-white transition">
              <InstagramIcon class="w-5 h-5" />
            </a>
            <a href="mailto:contact@dubbingbase.com" class="text-gray-500 hover:text-gray-900 dark:text-white transition">
              <MailIcon class="w-5 h-5" />
            </a>
          </div>
        </div>

        <!-- Explore -->
        <div>
          <h3 class="text-gray-900 dark:text-white font-semibold mb-4">{{ t('footer.explore') }}</h3>
          <ul class="space-y-3 text-sm">
            <li><NuxtLink :to="$localePath('/movies')" class="hover:text-gray-900 dark:text-white transition">{{ t('footer.movies') }}</NuxtLink></li>
            <li><NuxtLink :to="$localePath('/series')" class="hover:text-gray-900 dark:text-white transition">{{ t('footer.series') }}</NuxtLink></li>
            <li><NuxtLink :to="$localePath('/voice-actors')" class="hover:text-gray-900 dark:text-white transition">{{ t('footer.voiceActors') }}</NuxtLink></li>
          </ul>
        </div>

        <!-- Community -->
        <div>
          <h3 class="text-gray-900 dark:text-white font-semibold mb-4">{{ t('footer.community') }}</h3>
          <ul class="space-y-3 text-sm">
            <li><NuxtLink :to="$localePath('/guidelines')" class="hover:text-gray-900 dark:text-white transition">{{ t('footer.guidelines') }}</NuxtLink></li>
            <li><NuxtLink :to="$localePath('/discussions')" class="hover:text-gray-900 dark:text-white transition">{{ t('footer.discussions') }}</NuxtLink></li>
            <li><NuxtLink :to="$localePath('/leaderboard')" class="hover:text-gray-900 dark:text-white transition">{{ t('footer.leaderboard') }}</NuxtLink></li>
          </ul>
        </div>

        <!-- Legal -->
        <div>
          <h3 class="text-gray-900 dark:text-white font-semibold mb-4">{{ t('footer.legal') }}</h3>
          <ul class="space-y-3 text-sm">
            <li><NuxtLink :to="$localePath('/about')" class="hover:text-gray-900 dark:text-white transition">{{ t('about.title') }}</NuxtLink></li>
            <li><NuxtLink :to="$localePath('/privacy')" class="hover:text-gray-900 dark:text-white transition">{{ t('footer.privacy') }}</NuxtLink></li>
            <li><NuxtLink :to="$localePath('/terms')" class="hover:text-gray-900 dark:text-white transition">{{ t('footer.terms') }}</NuxtLink></li>
            <li><a href="mailto:contact@dubbingbase.com" class="hover:text-gray-900 dark:text-white transition">{{ t('footer.contact') }}</a></li>
          </ul>
        </div>
      </div>

      <div class="pt-8 border-t border-gray-200 dark:border-[#2a2a2a] flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
        <p>&copy; {{ new Date().getFullYear() }} DubbingBase. {{ t('footer.rights') }}</p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { TwitterIcon, InstagramIcon, MailIcon } from 'lucide-vue-next';

const { t } = useI18n();
</script>
