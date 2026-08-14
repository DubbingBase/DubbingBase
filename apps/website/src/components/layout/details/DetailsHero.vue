<template>
  <div class="relative w-full h-[50vh] min-h-[400px] bg-gray-200 dark:bg-[#1d1d1d]">
    <div class="absolute inset-0">
      <NuxtImg
        v-if="backdropUrl"
        :src="backdropUrl"
        :placeholder="backdropUrl.replace('/original/', '/w92/')"
        class="w-full h-full object-cover transition-opacity duration-500"
        :class="blurBackdrop ? 'blur-3xl opacity-50 scale-110' : ''"
        alt="Backdrop"
        format="webp"
        preload
        fetchpriority="high"
        loading="eager"
      />
      <div v-if="backdropUrl" class="absolute inset-0 bg-gradient-to-t from-gray-50 dark:from-[#1b1b1b] to-transparent"></div>
      <div v-if="backdropUrl" class="absolute inset-0 bg-black/10 dark:bg-black/40"></div>
    </div>

    <div class="absolute bottom-0 left-0 w-full p-8 flex flex-col md:flex-row gap-6 items-end">
      <div :class="[
        imageAspectRatio === 'poster' ? 'w-32 md:w-48 aspect-[2/3] object-cover rounded-lg shadow-xl shrink-0 overflow-hidden' : '',
        imageAspectRatio === 'profile' ? 'w-32 md:w-48 rounded-lg overflow-hidden shadow-xl aspect-[2/3] bg-gray-100 dark:bg-[#161616] border border-white/10 shrink-0' : '',
        imageAspectRatio === 'logo' ? 'w-32 h-32 md:w-48 md:h-48 rounded-xl shadow-xl bg-white dark:bg-[#2a2a2a] flex items-center justify-center overflow-hidden shrink-0 relative z-10' : ''
      ]">
        <NuxtImg
          v-if="imageUrl"
          :src="imageUrl"
          :placeholder="imageUrl.replace('/original/', '/w92/')"
          :class="[
            'w-full h-full transition-opacity duration-500',
            imageAspectRatio === 'logo' ? 'object-contain p-4' : 'object-cover'
          ]"
          :alt="title"
          format="webp"
          fetchpriority="high"
          loading="eager"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-[#161616] text-gray-400 text-6xl font-bold uppercase aspect-[2/3]"
        >
          {{ title?.[0] }}
        </div>
      </div>
      <div class="pb-4 max-w-3xl">
        <h1 class="text-4xl md:text-5xl font-bold">{{ title }}</h1>
        <div class="flex flex-wrap items-center gap-3 mt-4">
          <slot name="metadata"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  backdropUrl?: string | null;
  blurBackdrop?: boolean;
  imageUrl?: string | null;
  imageAspectRatio?: 'poster' | 'profile' | 'logo';
}>();
</script>
