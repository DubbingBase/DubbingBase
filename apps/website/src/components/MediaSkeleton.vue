<template>
  <div class="theme-surface-raised theme-bg min-h-screen">
    <!-- Hero Section Skeleton -->
    <div
      class="relative w-full h-[50vh] min-h-[400px] theme-surface-muted animate-pulse"
    >
      <div
        class="absolute inset-0 bg-gradient-to-t from-[var(--app-color-background)] to-transparent"
      ></div>

      <div
        class="absolute bottom-0 left-0 w-full p-8 flex flex-col md:flex-row gap-6 items-end"
      >
        <!-- Poster -->
        <div
          class="w-32 md:w-48 aspect-[2/3] theme-surface-muted rounded-lg shadow-xl"
        ></div>

        <!-- Title & Tags -->
        <div class="pb-4 w-full max-w-3xl">
          <div
            class="h-10 md:h-12 w-3/4 theme-surface-muted rounded-lg mb-4"
          ></div>
          <div class="flex flex-wrap gap-3">
            <div class="h-8 w-16 theme-surface-muted rounded-lg"></div>
            <div class="h-8 w-24 theme-surface-muted rounded-lg"></div>
            <div class="h-8 w-20 theme-surface-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Bar Skeleton -->
    <div
      class="border-b theme-border-subtle theme-border theme-surface-overlay backdrop-blur sticky top-0 z-10 shadow-sm"
    >
      <div
        class="container mx-auto px-8 max-w-6xl py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <!-- Tabs -->
        <div class="flex flex-wrap gap-2">
          <div
            class="h-9 w-24 theme-surface-muted rounded-lg animate-pulse"
          ></div>
          <div
            class="h-9 w-32 theme-surface-muted rounded-lg animate-pulse"
          ></div>
        </div>
        <!-- Right side actions -->
        <div class="flex items-center gap-4">
          <div
            class="h-9 w-32 theme-surface-muted rounded-lg animate-pulse"
          ></div>
        </div>
      </div>
    </div>

    <!-- Content Skeleton -->
    <div class="container mx-auto p-8 max-w-6xl">
      <!-- Overview/Synopsis -->
      <div class="mb-12 max-w-4xl animate-pulse">
        <div class="h-8 w-32 theme-surface-muted rounded-lg mb-4"></div>
        <div class="space-y-3">
          <div class="h-5 w-full theme-surface-muted rounded"></div>
          <div class="h-5 w-11/12 theme-surface-muted rounded"></div>
          <div class="h-5 w-4/5 theme-surface-muted rounded"></div>
        </div>
      </div>

      <!-- Cast and Crew header -->
      <div
        class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 animate-pulse"
      >
        <div class="h-8 w-48 theme-surface-muted rounded-lg"></div>
        <div class="h-10 w-full sm:w-64 theme-surface-muted rounded-xl"></div>
      </div>

      <!-- Cast Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 animate-pulse">
        <div
          v-for="i in 8"
          :key="i"
          class="theme-input border theme-border-subtle theme-border rounded-2xl p-4 shadow-sm"
        >
          <div class="flex flex-col sm:grid sm:grid-cols-3 gap-4">
            <div class="flex gap-3">
              <div
                class="w-12 h-12 rounded-full theme-surface-muted shrink-0"
              ></div>
              <div class="space-y-2 flex-1 pt-1">
                <div class="h-4 w-3/4 theme-surface-muted rounded"></div>
                <div class="h-3 w-1/2 theme-surface-muted rounded"></div>
              </div>
            </div>
            <div class="flex gap-3">
              <div
                class="w-12 h-12 rounded-full theme-surface-muted shrink-0"
              ></div>
              <div class="space-y-2 flex-1 pt-1">
                <div class="h-4 w-3/4 theme-surface-muted rounded"></div>
                <div class="h-3 w-1/2 theme-surface-muted rounded"></div>
              </div>
            </div>
            <div class="flex items-center justify-end">
              <div class="h-8 w-16 theme-surface-muted rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
