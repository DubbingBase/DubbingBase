<template>
  <div>
    <DetailsPage v-if="!loading">
      <DetailsHero
        :title="name"
        :image-url="profileUrl"
        :backdrop-url="backdropUrl"
        image-aspect-ratio="profile"
      >
        <template #metadata>
          <slot name="metadata"></slot>
        </template>
      </DetailsHero>

      <DetailsActionBar>
        <template #right>
          <slot name="actions"></slot>
        </template>
      </DetailsActionBar>

      <div class="w-full p-8">
        <slot name="biography"></slot>
        <slot name="content"></slot>
      </div>
    </DetailsPage>
    <PersonSkeleton v-else />
  </div>
</template>

<script setup lang="ts">
import DetailsPage from './details/DetailsPage.vue';
import DetailsHero from './details/DetailsHero.vue';
import DetailsActionBar from './details/DetailsActionBar.vue';
defineProps<{
  name?: string;
  profileUrl?: string | null;
  backdropUrl?: string | null;
  loading?: boolean;
}>();
</script>
