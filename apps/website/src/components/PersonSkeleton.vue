<template>
  <div class="bg-gray-50 dark:bg-[#1b1b1b] min-h-screen">
    <!-- Hero Section Skeleton -->
    <div class="relative w-full h-[50vh] min-h-[400px] bg-gray-200 dark:bg-[#1d1d1d] animate-pulse">
      <div class="absolute inset-0 bg-gradient-to-t from-gray-50 dark:from-[#1b1b1b] to-transparent"></div>
      
      <div class="absolute bottom-0 left-0 w-full p-8 flex flex-col md:flex-row gap-6 items-end">
        <!-- Profile Image -->
        <div class="w-32 md:w-48 aspect-[2/3] bg-gray-300 dark:bg-[#333] rounded-lg shadow-xl shrink-0"></div>
        
        <!-- Name & Info -->
        <div class="pb-4 w-full max-w-3xl">
          <h1 class="h-10 md:h-12 w-2/3 bg-gray-300 dark:bg-[#333] rounded-lg mb-4 text-transparent select-none"><span class="sr-only">Loading</span></h1>
          <div class="flex flex-wrap gap-3">
            <div class="h-8 w-24 bg-gray-300 dark:bg-[#333] rounded-lg"></div>
            <div class="h-8 w-20 bg-gray-300 dark:bg-[#333] rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Bar Skeleton -->
    <div class="border-b border-gray-200 dark:border-[#2a2a2a] bg-white/95 dark:bg-[#161616]/95 backdrop-blur sticky top-0 z-10 shadow-sm">
      <div class="container mx-auto px-8 max-w-6xl py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <!-- Left side actions -->
        <div class="flex flex-wrap gap-2">
          <div class="h-9 w-24 bg-gray-200 dark:bg-[#2a2a2a] rounded-lg animate-pulse"></div>
        </div>
        <!-- Right side actions -->
        <div class="flex items-center gap-4">
          <div class="h-9 w-32 bg-gray-200 dark:bg-[#2a2a2a] rounded-lg animate-pulse"></div>
        </div>
      </div>
    </div>

    <!-- Content Skeleton -->
    <div class="container mx-auto p-8 max-w-6xl">
      <!-- Overview/Biography -->
      <div class="mb-12 max-w-4xl animate-pulse">
        <div class="h-8 w-32 bg-gray-200 dark:bg-[#2a2a2a] rounded-lg mb-4"></div>
        <div class="space-y-3">
          <div class="h-5 w-full bg-gray-200 dark:bg-[#2a2a2a] rounded"></div>
          <div class="h-5 w-11/12 bg-gray-200 dark:bg-[#2a2a2a] rounded"></div>
          <div class="h-5 w-4/5 bg-gray-200 dark:bg-[#2a2a2a] rounded"></div>
        </div>
      </div>

      <!-- Works/Roles header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 animate-pulse">
        <div class="h-8 w-48 bg-gray-200 dark:bg-[#2a2a2a] rounded-lg"></div>
      </div>

      <!-- Works Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-pulse">
        <div v-for="i in 6" :key="i" class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm">
          <div class="flex flex-col sm:grid sm:grid-cols-3 gap-4 h-full">
            <div class="w-16 sm:w-full aspect-[2/3] rounded-xl bg-gray-200 dark:bg-[#333] shrink-0"></div>
            <div class="flex flex-col gap-2 col-span-2">
              <div class="h-4 w-full bg-gray-200 dark:bg-[#333] rounded"></div>
              <div class="h-3 w-2/3 bg-gray-200 dark:bg-[#333] rounded"></div>
              <div class="h-3 w-1/2 bg-gray-200 dark:bg-[#333] rounded mt-4"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
