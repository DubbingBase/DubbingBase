<template>
  <div>
    <DetailsPage v-if="!loading">
      <DetailsHero
        :title="title"
        :backdrop-url="backdropUrl"
        :image-url="posterUrl"
        image-aspect-ratio="poster"
      >
        <template #metadata>
          <slot name="metadata"></slot>
        </template>
      </DetailsHero>

      <DetailsActionBar>
        <template #left>
          <slot name="actions-left"></slot>
        </template>
        <template #right>
          <slot name="actions-right"></slot>
          <DetailsShareButton :title="title ?? ''" :dub="shareDub" />
        </template>
      </DetailsActionBar>

      <div class="w-full min-w-0 p-4 sm:p-6 lg:p-8">
        <slot name="content"></slot>
      </div>
    </DetailsPage>
    <MediaSkeleton v-else />
  </div>
</template>

<script setup lang="ts">
import DetailsPage from "./details/DetailsPage.vue";
import DetailsHero from "./details/DetailsHero.vue";
import DetailsActionBar from "./details/DetailsActionBar.vue";
import DetailsShareButton from "./details/DetailsShareButton.vue";
import type { ShareDub } from "../../utils/share";
defineProps<{
  /** Currently selected valid dubbing project id, or "original". */
  shareDub?: ShareDub;
  title?: string;
  backdropUrl?: string | null;
  posterUrl?: string | null;
  loading?: boolean;
}>();
</script>
