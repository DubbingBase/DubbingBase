<template>
  <div class="w-full flex flex-col min-h-screen">
    <header class="bg-blue-600 text-white p-4">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold">Dashboard</h1>
        <router-link
          to="/voice-actor-spreadsheet"
          class="px-4 py-2 bg-white text-blue-600 rounded-md font-medium text-sm"
        >
          Voice Actor Spreadsheet
        </router-link>
      </div>
    </header>
    <main class="flex-1 p-4 space-y-4 overflow-x-hidden">
      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center h-64">
        <p class="text-gray-500">Loading dashboard data...</p>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="bg-red-100 p-4 rounded-lg">
        <p class="text-red-700">{{ error }}</p>
        <button @click="fetchDashboardData" class="mt-2 px-4 py-2 bg-red-600 text-white rounded">
          Retry
        </button>
      </div>

      <!-- Charts -->
      <div v-else class="space-y-4">
        <!-- User Registrations Bar Chart -->
        <div class="bg-white p-4 rounded-lg shadow max-w-full">
          <h2 class="text-lg font-semibold mb-2">User Registrations Over Time</h2>
          <BarChart :data="userRegistrationsData" :options="barChartOptions" />
        </div>

        <!-- Voice Actor Growth Line Chart -->
        <div class="bg-white p-4 rounded-lg shadow max-w-full">
          <h2 class="text-lg font-semibold mb-2">Voice Actor Growth</h2>
          <div class="mb-4">
            <label for="time-unit" class="block text-sm font-medium text-gray-700 mb-1">Time Unit</label>
            <select id="time-unit" v-model="selectedUnit" class="w-full p-2 border border-gray-300 rounded-md">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
          <LineChart :data="voiceActorGrowthData" :options="lineChartOptions" />
        </div>

        <!-- Top Voice Actors Pie Chart -->
        <div class="bg-white p-4 rounded-lg shadow max-w-full">
          <h2 class="text-lg font-semibold mb-2">Top Voice Actors</h2>
          <PieChart :data="topVoiceActorsData" :options="pieChartOptions" />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { supabase } from "@/lib/supabase";
import BarChart from "@/components/charts/BarChart.vue";
import LineChart from "@/components/charts/LineChart.vue";
import PieChart from "@/components/charts/PieChart.vue";
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

// Chart data
const userRegistrationsData = ref<ChartData>({
  labels: [],
  datasets: [{
    label: 'User Registrations',
    data: [],
    backgroundColor: 'rgba(54, 162, 235, 0.6)',
    borderColor: 'rgba(54, 162, 235, 1)',
    borderWidth: 1
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
      label: 'Voice Actor Links',
      data: aggregated.map(item => item.count),
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.1
    }, {
      label: 'Cumulative Voice Actors',
      data: cumulative,
      borderColor: 'rgba(0, 128, 128, 1)',
      backgroundColor: 'rgba(0, 128, 128, 0.2)',
      tension: 0.1
    }]
  };
});

const topVoiceActorsData = ref<ChartData>({
  labels: [],
  datasets: [{
    label: 'Roles',
    data: [],
    backgroundColor: [
      'rgba(255, 99, 132, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 205, 86, 0.6)',
      'rgba(75, 192, 192, 0.6)',
      'rgba(153, 102, 255, 0.6)',
      'rgba(255, 159, 64, 0.6)',
      'rgba(199, 199, 199, 0.6)',
      'rgba(83, 102, 255, 0.6)',
      'rgba(255, 99, 255, 0.6)',
      'rgba(99, 255, 132, 0.6)'
    ],
    borderWidth: 1
  }]
});

// Chart options
const barChartOptions: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
};

const lineChartOptions: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
};

const pieChartOptions: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom'
    }
  }
};

// Data fetching function
const fetchDashboardData = async () => {
  try {
    loading.value = true;
    error.value = null;

    const { data, error: invokeError } = await supabase.functions.invoke('dashboard-stats');

    if (invokeError) throw invokeError;

    const stats = data as {
      userCount: number;
      voiceActorCount: number;
      userGrowth: { date: string; count: number }[];
      voiceActorGrowth: { date: string; count: number }[];
      topVoiceActors: any[];
    };

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

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load dashboard data';
    console.error('Dashboard data fetch error:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchDashboardData();
});
</script>

<style scoped>
/* Mobile-only styles */
.space-y-4 > * + * {
  margin-top: 1rem;
}

/* No hover states as per project rules */
</style>