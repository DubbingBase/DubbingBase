<template>
  <div class="max-w-4xl mx-auto px-6 py-12">
    <h1 class="text-3xl font-extrabold text-gray-900 dark:text-white mb-8">{{ t('about.title') }}</h1>
    
    <div class="space-y-8">
      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">{{ t('about.attributions') }}</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="p-6 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] rounded-xl shadow-sm">
            <h3 class="font-semibold text-gray-900 dark:text-white mb-2">{{ t('about.usersTitle') }}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{{ t('about.usersDescription') }}</p>
          </div>
          
          <a href="https://thetvdb.com/" target="_blank" rel="noopener noreferrer" class="block p-6 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] rounded-xl shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer">
            <h3 class="font-semibold text-gray-900 dark:text-white mb-2">{{ t('about.tvdbTitle') }}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{{ t('about.tvdbDescription') }}</p>
          </a>
          
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" class="block p-6 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] rounded-xl shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer">
            <h3 class="font-semibold text-gray-900 dark:text-white mb-2">{{ t('about.tmdbTitle') }}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{{ t('about.tmdbDescription') }}</p>
          </a>
          
          <a href="https://www.igdb.com/" target="_blank" rel="noopener noreferrer" class="block p-6 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] rounded-xl shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer">
            <h3 class="font-semibold text-gray-900 dark:text-white mb-2">{{ t('about.igdbTitle') }}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{{ t('about.igdbDescription') }}</p>
          </a>

          <a href="https://discord.gg/Jm2EmnnpG" target="_blank" rel="noopener noreferrer" class="block p-6 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] rounded-xl shadow-sm hover:border-[#5865F2] dark:hover:border-[#5865F2] transition-colors cursor-pointer">
            <h3 class="font-semibold text-[#5865F2] mb-2">Discord</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{{ t('about.discordDescription') }}</p>
          </a>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>
