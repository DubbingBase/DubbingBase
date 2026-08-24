<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">{{ $t('settings.title') }}</h2>
    
    <div class="space-y-8">
      <!-- Preferences Section -->
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">{{ $t('settings.preferences') }}</h3>
        <div class="bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-100 dark:border-white/5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ $t('settings.emailNotifications') }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('settings.emailNotificationsDescription') }}</p>
            </div>
            <button type="button" class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 dark:bg-slate-700 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2" role="switch" aria-checked="false">
              <span class="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Danger Zone -->
      <div>
        <h3 class="text-lg font-medium text-red-600 dark:text-red-400 mb-4">{{ $t('settings.dangerZone') }}</h3>
        <div class="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p class="text-sm font-medium text-red-900 dark:text-red-300">{{ $t('settings.deleteAccount') }}</p>
              <p class="text-sm text-red-700 dark:text-red-400/80">{{ $t('settings.deleteAccountDescription') }}</p>
            </div>
            <button type="button" class="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
              {{ $t('settings.deleteAccount') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Settings logic
</script>
