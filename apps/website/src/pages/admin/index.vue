<template>
  <div class="space-y-6">
    <!-- Quick Actions Header -->
    <div class="bg-white dark:bg-[#1d1d1d] p-5 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] flex flex-wrap items-center justify-between gap-4 shadow-xl">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage dubbing projects, voice actors, and system statistics.</p>
      </div>
      <div class="flex items-center space-x-3">
        <NuxtLink
          :to="localePath('/admin/movies/new')"
          class="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold rounded-xl shadow-lg transition-all flex items-center space-x-1.5"
        >
          <span>+ Create Movie / TV Project</span>
        </NuxtLink>
        <NuxtLink
          :to="localePath('/game/new/edit/new')"
          class="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-gray-900 text-xs font-semibold rounded-xl shadow-lg transition-all flex items-center space-x-1.5"
        >
          <span>+ Create Video Game Project</span>
        </NuxtLink>
        <NuxtLink
          :to="localePath('/voice-actor/new')"
          class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-[#2a2a2a] dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 transition-all flex items-center space-x-1.5"
        >
          <span>+ Create Voice Actor</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 space-y-3 bg-gray-50/50 dark:bg-[#1d1d1d]/40 border border-gray-200 dark:border-[#2a2a2a] rounded-2xl">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      <p class="text-gray-500 dark:text-gray-400 text-sm">Loading dashboard data...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center justify-between text-red-700 dark:text-red-200 text-sm">
      <div class="flex items-center space-x-3">
        <svg class="h-5 w-5 text-red-500 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{{ error }}</span>
      </div>
      <button
        @click="fetchDashboardData"
        class="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-all"
      >
        Retry
      </button>
    </div>

    <!-- Charts Grid Layout -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- User Registrations Bar Chart -->
      <div class="bg-white dark:bg-[#1d1d1d] p-6 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-xl max-w-full lg:col-span-2">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">User Registrations Over Time</h2>
        <BarChart :data="userRegistrationsData" :options="barChartOptions" />
      </div>

      <!-- Voice Actor Growth Line Chart -->
      <div class="bg-white dark:bg-[#1d1d1d] p-6 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-xl max-w-full">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">Voice Actor Growth</h2>
          <div class="flex items-center space-x-2">
            <label for="time-unit" class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ $t('admin.dashboard.timeUnit') }}</label>
            <select
              id="time-unit"
              v-model="selectedUnit"
              class="bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2a2a2a] text-gray-700 dark:text-gray-200 text-xs font-medium rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-150"
            >
              <option value="day">{{ $t('admin.dashboard.day') }}</option>
              <option value="week">{{ $t('admin.dashboard.week') }}</option>
              <option value="month">{{ $t('admin.dashboard.month') }}</option>
            </select>
          </div>
        </div>
        <LineChart :data="voiceActorGrowthData" :options="lineChartOptions" />
      </div>

      <!-- Top Voice Actors Pie Chart -->
      <div class="bg-white dark:bg-[#1d1d1d] p-6 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-xl max-w-full">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ $t('admin.dashboard.topVoiceActors') }}</h2>
        <PieChart :data="topVoiceActorsData" :options="pieChartOptions" />
      </div>
    </div>
  </div>
  </template>

<script setup lang="ts">
const localePath = useLocalePath();




definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

import { ref, onMounted, computed } from "vue";
import BarChart from "@/components/admin/charts/BarChart.vue";
import LineChart from "@/components/admin/charts/LineChart.vue";
import PieChart from "@/components/admin/charts/PieChart.vue";
import type { ChartData, ChartOptions } from 'chart.js';



// Reactive state
const loading = ref(true);
const error = ref<string | null>(null);
const userCount = ref(0);
const voiceActorCount = ref(0);
const userRegistrations = ref<any[]>([]);
const voiceActorGrowth = ref<any[]>([]);
const topVoiceActors = ref<any[]>([]);
const selectedUnit = ref('day');

// Utility functions
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function aggregateData(data: { date: string; count: number }[], unit: string) {
  if (unit === 'day') {
    return data.map(item => ({ period: item.date, count: item.count })).sort((a, b) => a.period.localeCompare(b.period));
  } else if (unit === 'month') {
    const grouped = data.reduce((acc, item) => {
      const month = item.date.slice(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + item.count;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([period, count]) => ({ period, count })).sort((a, b) => a.period.localeCompare(b.period));
  } else if (unit === 'week') {
    const grouped = data.reduce((acc, item) => {
      const date = new Date(item.date);
      const year = date.getFullYear();
      const week = getISOWeek(date);
      const key = `${year}-W${week.toString().padStart(2, '0')}`;
      acc[key] = (acc[key] || 0) + item.count;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([period, count]) => ({ period, count })).sort((a, b) => a.period.localeCompare(b.period));
  }
  return [];
}

// Chart text and grid styling constants
const chartTextColor = '#6b7280'; 
const chartGridColor = 'rgba(156, 163, 175, 0.2)'; 

// Chart data
const userRegistrationsData = ref<ChartData>({
  labels: [],
  datasets: [{
    label: 'User Registrations',
    data: [],
    backgroundColor: 'rgba(59, 130, 246, 0.25)', // blue-500 with opacity
    borderColor: 'rgb(59, 130, 246)',
    borderWidth: 1.5,
    borderRadius: 6
  }]
});

const voiceActorGrowthData = computed<ChartData>(() => {
  const aggregated = aggregateData(voiceActorGrowth.value, selectedUnit.value);
  const cumulative = aggregated.reduce((acc, item, index) => {
    const prev = index > 0 ? acc[index - 1] : 0;
    acc.push(prev + item.count);
    return acc;
  }, [] as number[]);
  return {
    labels: aggregated.map(item => item.period),
    datasets: [{
      label: 'New Voice Actors',
      data: aggregated.map(item => item.count),
      borderColor: 'rgb(168, 85, 247)', // purple-500
      backgroundColor: 'rgba(168, 85, 247, 0.1)',
      tension: 0.4,
      fill: true
    }, {
      label: 'Cumulative Voice Actors',
      data: cumulative,
      borderColor: 'rgb(236, 72, 153)', // pink-500
      backgroundColor: 'rgba(236, 72, 153, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };
});

const topVoiceActorsData = ref<ChartData>({
  labels: [],
  datasets: [{
    label: 'Roles',
    data: [],
    backgroundColor: [
      'rgba(59, 130, 246, 0.8)',   // blue-500
      'rgba(168, 85, 247, 0.8)',  // purple-500
      'rgba(236, 72, 153, 0.8)',   // pink-500
      'rgba(244, 63, 94, 0.8)',    // rose-500
      'rgba(249, 115, 22, 0.8)',   // orange-500
      'rgba(234, 179, 8, 0.8)',    // yellow-500
      'rgba(34, 197, 94, 0.8)',    // green-500
      'rgba(20, 184, 166, 0.8)',   // teal-500
      'rgba(6, 182, 212, 0.8)',    // cyan-500
      'rgba(99, 102, 241, 0.8)'    // indigo-500
    ],
    borderColor: '#0f172a', // gray-900 to separate segments cleanly
    borderWidth: 2
  }]
});

// Chart options
const barChartOptions = computed<ChartOptions>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    }
  },
  scales: {
    x: {
      grid: {
        color: chartGridColor
      },
      ticks: {
        color: chartTextColor,
        font: {
          family: 'Inter, sans-serif',
          size: 11
        }
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: chartGridColor
      },
      ticks: {
        color: chartTextColor,
        font: {
          family: 'Inter, sans-serif',
          size: 11
        }
      }
    }
  }
}));

const lineChartOptions = computed<ChartOptions>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      labels: {
        color: chartTextColor,
        font: {
          family: 'Inter, sans-serif',
          size: 11
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: chartGridColor
      },
      ticks: {
        color: chartTextColor,
        font: {
          family: 'Inter, sans-serif',
          size: 11
        }
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: chartGridColor
      },
      ticks: {
        color: chartTextColor,
        font: {
          family: 'Inter, sans-serif',
          size: 11
        }
      }
    }
  }
}));

const pieChartOptions = computed<ChartOptions>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: chartTextColor,
        font: {
          family: 'Inter, sans-serif',
          size: 11
        }
      }
    }
  }
}));

const { data: dashboardData, pending, error: fetchError, refresh: fetchDashboardData } = await useAsyncData('admin-dashboard', async () => {
  const data = await $fetch('/api/dashboard-stats') as {
    userCount: number;
    voiceActorCount: number;
    userGrowth: { date: string; count: number }[];
    voiceActorGrowth: { date: string; count: number }[];
    topVoiceActors: any[];
  };
});

watch(dashboardData, (stats) => {
  if (stats) {
    userCount.value = stats.userCount;
    voiceActorCount.value = stats.voiceActorCount;

    // Group user growth by month
    const userGrouped = stats.userGrowth.reduce((acc: any, item) => {
      const month = item.date.slice(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + item.count;
      return acc;
    }, {});

    userRegistrations.value = Object.entries(userGrouped).map(([month, count]) => ({ month, count }));

    // Update user registrations chart data
    userRegistrationsData.value.labels = userRegistrations.value.map(item => item.month);
    userRegistrationsData.value.datasets[0].data = userRegistrations.value.map(item => item.count);

    voiceActorGrowth.value = stats.voiceActorGrowth;
    topVoiceActors.value = stats.topVoiceActors;

    // Update top voice actors chart data
    topVoiceActorsData.value.labels = topVoiceActors.value.map(item =>
      `${item.firstname} ${item.lastname}`
    );
    topVoiceActorsData.value.datasets[0].data = topVoiceActors.value.map(item => item.role_count);
  }
}, { immediate: true });

watch(pending, (val) => {
  loading.value = val;
}, { immediate: true });

watch(fetchError, (err) => {
  if (err) {
    error.value = err.message || 'Failed to load dashboard data';
    console.error('Dashboard data fetch error:', err);
  } else {
    error.value = null;
  }
}, { immediate: true });
</script>

<style scoped>
/* Mobile-only styles */
.space-y-4 > * + * {
  margin-top: 1rem;
}

/* No hover states as per project rules */
</style>