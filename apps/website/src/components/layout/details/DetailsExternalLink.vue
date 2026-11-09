<template>
  <DetailsMetaChip :href="href" variant="link"
    >{{ label }}<ExternalLinkIcon class="w-3.5 h-3.5 opacity-70" aria-hidden="true"
  /></DetailsMetaChip>
</template>

<script setup lang="ts">
import { ExternalLinkIcon } from "lucide-vue-next";
import DetailsMetaChip from "./DetailsMetaChip.vue";
defineProps<{ href: string; label: string }>();
</script>
