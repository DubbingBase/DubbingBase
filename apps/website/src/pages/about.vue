<template>
  <div class="max-w-4xl mx-auto px-6 py-12">
    <h1 class="text-3xl font-extrabold theme-text mb-8">
      {{ t("about.title") }}
    </h1>

    <div class="space-y-8">
      <section>
        <h2 class="text-xl font-bold theme-text mb-4">
          {{ t("about.attributions") }}
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            class="p-6 theme-surface border theme-border-subtle theme-border rounded-xl shadow-sm"
          >
            <h3 class="font-semibold theme-text mb-2">
              {{ t("about.usersTitle") }}
            </h3>
            <p
              class="theme-text-secondary theme-text-muted text-sm leading-relaxed"
            >
              {{ t("about.usersDescription") }}
            </p>
          </div>

          <a
            href="https://thetvdb.com/"
            target="_blank"
            rel="noopener noreferrer"
            class="block p-6 theme-surface border theme-border-subtle theme-border rounded-xl shadow-sm theme-hover-border-strong transition-colors cursor-pointer"
          >
            <h3 class="font-semibold theme-text mb-2">
              {{ t("about.tvdbTitle") }}
            </h3>
            <p
              class="theme-text-secondary theme-text-muted text-sm leading-relaxed"
            >
              {{ t("about.tvdbDescription") }}
            </p>
          </a>

          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            class="block p-6 theme-surface border theme-border-subtle theme-border rounded-xl shadow-sm theme-hover-border-strong transition-colors cursor-pointer"
          >
            <h3 class="font-semibold theme-text mb-2">
              {{ t("about.tmdbTitle") }}
            </h3>
            <p
              class="theme-text-secondary theme-text-muted text-sm leading-relaxed"
            >
              {{ t("about.tmdbDescription") }}
            </p>
          </a>

          <a
            href="https://www.igdb.com/"
            target="_blank"
            rel="noopener noreferrer"
            class="block p-6 theme-surface border theme-border-subtle theme-border rounded-xl shadow-sm theme-hover-border-strong transition-colors cursor-pointer"
          >
            <h3 class="font-semibold theme-text mb-2">
              {{ t("about.igdbTitle") }}
            </h3>
            <p
              class="theme-text-secondary theme-text-muted text-sm leading-relaxed"
            >
              {{ t("about.igdbDescription") }}
            </p>
          </a>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
</script>
