<template>
  <div class="min-h-screen bg-gray-900 text-gray-100 font-sans">
    <Header />
    <router-view />
    <SmartBanner />
  </div>
</template>

<script setup lang="ts">
import Header from './components/Header.vue';
import SmartBanner from './components/SmartBanner.vue';
</script>
