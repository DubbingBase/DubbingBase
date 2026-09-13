<template>
  <div>
    <h2 class="text-xl font-semibold theme-text mb-6">
      {{ $t("settings.apiKeys") }}
    </h2>

    <div class="space-y-6">
      <p class="text-sm theme-text-secondary theme-text-muted">
        {{ $t("settings.apiKeysDescription") }}
      </p>

      <div
        class="theme-surface-raised p-6 rounded-xl border theme-border-subtle text-center"
      >
        <div
          class="inline-flex items-center justify-center w-12 h-12 rounded-full theme-status-info mb-4"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            ></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium theme-text mb-2">
          {{ $t("settings.noApiKeys") }}
        </h3>
        <p class="text-sm theme-text-muted mb-6 max-w-sm mx-auto">
          {{ $t("settings.generateApiKeyDescription") }}
        </p>
        <button
          type="button"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm theme-text bg-gradient-to-r from-[#00E5FF] to-cyan-500 hover:from-cyan-400 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-colors"
        >
          {{ $t("settings.generateNewKey") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Logic for API keys will go here
</script>
