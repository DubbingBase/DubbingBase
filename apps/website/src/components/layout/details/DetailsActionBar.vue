<template>
  <div class="border-b border-gray-200 dark:border-[#2a2a2a] bg-white/95 dark:bg-[#161616]/95 backdrop-blur sticky top-0 z-10 shadow-sm">
    <div class="w-full px-8 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <!-- Left actions -->
      <slot name="left"></slot>
      
      <!-- Right actions -->
      <div class="flex items-center flex-wrap gap-4">
        <slot name="right"></slot>
      </div>
    </div>
  </div>
</template>
