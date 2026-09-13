<template>
  <div
    class="relative w-full h-[42vh] min-h-[300px] md:h-[50vh] md:min-h-[400px] overflow-hidden theme-surface-muted theme-surface"
  >
    <div class="absolute inset-0">
      <NuxtImg
        v-if="backdropUrl"
        :src="backdropUrl"
        :placeholder="backdropUrl.replace('/original/', '/w92/')"
        class="w-full h-full object-cover"
        :class="blurBackdrop ? 'blur-3xl opacity-50 scale-110' : ''"
        alt="Backdrop"
        format="webp"
      />
      <div
        v-if="backdropUrl"
        class="absolute inset-0 bg-gradient-to-t from-[var(--app-color-background)] to-transparent"
      ></div>
      <div
        v-if="backdropUrl"
        class="absolute inset-0 theme-backdrop-scrim"
      ></div>
    </div>

    <div
      class="absolute bottom-0 left-0 w-full p-4 sm:p-6 md:p-8 flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-end"
    >
      <div
        :class="[
          imageAspectRatio === 'poster'
            ? 'w-24 sm:w-32 md:w-48 object-cover rounded-lg shadow-xl shrink-0 overflow-hidden'
            : '',
          imageAspectRatio === 'profile'
            ? 'w-24 sm:w-32 md:w-48 rounded-lg overflow-hidden shadow-xl aspect-[2/3] theme-surface-raised theme-input border theme-border-subtle shrink-0'
            : '',
          imageAspectRatio === 'logo'
            ? 'w-24 h-24 sm:w-32 sm:h-32 md:w-48 md:h-48 rounded-xl shadow-xl theme-surface-muted flex items-center justify-center overflow-hidden shrink-0 relative z-10'
            : '',
        ]"
      >
        <NuxtImg
          v-if="imageUrl"
          :src="imageUrl"
          :placeholder="imageUrl.replace('/original/', '/w92/')"
          :class="[
            'w-full h-full',
            imageAspectRatio === 'logo' ? 'object-contain p-4' : 'object-cover',
          ]"
          :alt="title"
          format="webp"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center theme-surface-raised theme-input theme-text-muted text-6xl font-bold uppercase aspect-[2/3]"
        >
          {{ title?.[0] }}
        </div>
      </div>
      <div class="min-w-0 flex-1 max-w-3xl md:pb-4">
        <h1
          class="text-2xl sm:text-3xl md:text-5xl leading-tight font-bold break-words"
        >
          {{ title }}
        </h1>
        <div class="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 sm:mt-4">
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
  imageAspectRatio?: "poster" | "profile" | "logo";
}>();
</script>
