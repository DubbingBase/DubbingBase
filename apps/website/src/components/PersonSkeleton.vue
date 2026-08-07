<template>
  <div class="max-w-7xl mx-auto p-6">
    <div class="space-y-12 relative pt-12">
      <!-- Profile Header -->
      <section class="flex flex-col md:flex-row gap-8 items-start">
        <div class="w-48 h-48 md:w-64 md:h-64 rounded-2xl flex-shrink-0 bg-gray-200 dark:bg-[#2a2a2a] animate-pulse"></div>
        
        <div class="flex-1 space-y-4 w-full">
          <!-- Name -->
          <div class="h-12 w-3/4 md:w-1/2 bg-gray-200 dark:bg-[#2a2a2a] rounded-lg animate-pulse"></div>
          
          <!-- Tags -->
          <div class="flex flex-wrap gap-3">
            <div class="h-6 w-24 bg-gray-200 dark:bg-[#2a2a2a] rounded-full animate-pulse"></div>
            <div class="h-6 w-32 bg-gray-200 dark:bg-[#2a2a2a] rounded-full animate-pulse"></div>
            <div class="h-6 w-28 bg-gray-200 dark:bg-[#2a2a2a] rounded-full animate-pulse"></div>
          </div>
          
          <!-- Bio -->
          <div class="mt-6 p-6 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616]">
            <div class="space-y-3">
              <div class="h-4 w-full bg-gray-200 dark:bg-[#2a2a2a] rounded animate-pulse"></div>
              <div class="h-4 w-11/12 bg-gray-200 dark:bg-[#2a2a2a] rounded animate-pulse"></div>
              <div class="h-4 w-4/5 bg-gray-200 dark:bg-[#2a2a2a] rounded animate-pulse"></div>
              <div class="h-4 w-full bg-gray-200 dark:bg-[#2a2a2a] rounded animate-pulse"></div>
              <div class="h-4 w-3/4 bg-gray-200 dark:bg-[#2a2a2a] rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- Search Bar -->
      <div class="w-full max-w-xl mb-6">
        <div class="h-12 w-full bg-gray-200 dark:bg-[#2a2a2a] rounded-xl animate-pulse"></div>
      </div>

      <!-- Works Grid -->
      <section>
        <div class="h-8 w-48 bg-gray-200 dark:bg-[#2a2a2a] rounded-lg animate-pulse mb-8"></div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div v-for="i in 8" :key="i" class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl overflow-hidden animate-pulse">
            <div class="w-full aspect-[2/3] bg-gray-200 dark:bg-[#2a2a2a]"></div>
            <div class="p-4 space-y-3">
              <div class="h-5 w-3/4 bg-gray-200 dark:bg-[#333] rounded"></div>
              <div class="flex gap-2 items-center">
                <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#333]"></div>
                <div class="h-4 w-1/2 bg-gray-200 dark:bg-[#333] rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
