<template>
  <div class="h-50">
    <ClientOnly>
      <Bar :data="data" :options="mergedOptions" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import { computed } from 'vue'

interface Props {
  data: ChartData<any>
  options: ChartOptions<any>
}

const props = defineProps<Props>()

const mergedOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  height: 200,
  ...props.options
}))
</script>