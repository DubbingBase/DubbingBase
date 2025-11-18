<template>
  <div class="h-50">
    <Pie :data="data" :options="mergedOptions" />
  </div>
</template>

<script setup lang="ts">
import { Pie } from 'vue-chartjs'
import { ChartData, ChartOptions } from 'chart.js'
import { computed } from 'vue'

interface Props {
  data: ChartData
  options: ChartOptions
}

const props = defineProps<Props>()

const mergedOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  height: 200,
  ...props.options
}))
</script>