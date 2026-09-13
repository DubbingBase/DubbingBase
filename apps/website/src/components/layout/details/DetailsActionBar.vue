<template>
  <div
    class="border-b theme-border-subtle theme-border theme-surface-overlay backdrop-blur sticky top-0 z-10 shadow-sm"
  >
    <div
      class="w-full min-w-0 px-4 sm:px-6 md:px-8 py-3 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4"
    >
      <!-- Left actions -->
      <div class="flex w-full min-w-0 flex-wrap items-center gap-2 md:w-auto">
        <slot name="left"></slot>
      </div>

      <!-- Right actions -->
      <div
        class="flex w-full min-w-0 items-center flex-wrap gap-2 md:w-auto md:justify-end"
      >
        <slot name="right"></slot>
      </div>
    </div>
  </div>
</template>
