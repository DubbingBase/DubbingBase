<script setup lang="ts">
import { onMounted } from "vue";
import { initializeAuth } from "@/lib/auth";

onMounted(() => {
  initializeAuth();
});
</script>

<template>
  <router-view />
</template>

<style scoped>
/* App wide custom layouts */
</style>