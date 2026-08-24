<template>
  <div class="space-y-6">
    <!-- Top toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-900 p-5 rounded-2xl border border-gray-800">
      <div>
        <h3 class="text-lg font-bold text-white">{{ $t('admin.reports.title') }}</h3>
        <p class="text-sm text-gray-400">{{ $t('admin.reports.description') }}</p>
      </div>
      <div class="flex items-center space-x-3">
        <button
          @click="fetchReports"
          :disabled="loading"
          class="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
        >
          <span v-if="loading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
          <span>{{ $t('common.refresh') }}</span>
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-center space-x-3 text-red-200 text-sm">
      <svg class="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Reports Table Card -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <!-- Loading indicator -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 space-y-3">
        <div class="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-500"></div>
        <p class="text-gray-400 text-sm">{{ $t('admin.reports.fetchingReports') }}</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="reports.length === 0" class="text-center py-16 space-y-2">
        <p class="text-gray-400 font-medium">{{ $t('admin.reports.noReportsFound') }}</p>
        <p class="text-xs text-gray-500">{{ $t('admin.reports.everythingLooksGood') }}</p>
      </div>

      <!-- Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-900/40">
              <th class="py-4 px-6">{{ $t('admin.reports.details') }}</th>
              <th class="py-4 px-6">{{ $t('admin.reports.target') }}</th>
              <th class="py-4 px-6">{{ $t('admin.reports.reporter') }}</th>
              <th class="py-4 px-6">{{ $t('admin.reports.status') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800/60">
            <tr v-for="report in reports" :key="report.id" class="hover:bg-gray-800/10 transition-colors">
              <td class="py-4 px-6">
                <div class="font-semibold text-white">{{ report.reason }}</div>
                <div class="text-xs text-gray-400 mt-1 max-w-sm truncate" :title="report.details || ''">{{ report.details || $t('admin.reports.noDetailsProvided') }}</div>
                <div class="text-xs text-gray-500 mt-1">{{ formatDate(report.created_at) }}</div>
              </td>
              <td class="py-4 px-6 font-mono text-xs text-blue-400">
                <NuxtLink :to="localePath(report.target_url)" target="_blank" class="hover:underline flex items-center space-x-1">
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>{{ $t('common.link') }}</span>
                </NuxtLink>
              </td>
              <td class="py-4 px-6 text-xs text-gray-400">
                {{ report.reporter_id }}
              </td>
              <td class="py-4 px-6">
                <select
                  v-model="report.status"
                  @change="updateStatus(report)"
                  :disabled="updatingStatus[report.id]"
                  class="bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  :class="{
                    'text-yellow-400': report.status === 'pending',
                    'text-green-400': report.status === 'resolved',
                    'text-gray-400': report.status === 'dismissed'
                  }"
                >
                  <option value="pending">{{ $t('admin.reports.statusPending') }}</option>
                  <option value="resolved">{{ $t('admin.reports.statusResolved') }}</option>
                  <option value="dismissed">{{ $t('admin.reports.statusDismissed') }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Toast Notifications -->
    <div
      v-if="toast.show"
      class="fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl text-sm max-w-sm flex items-center space-x-3"
      :class="
        toast.type === 'success'
          ? 'bg-green-950/40 border-green-900/60 text-green-200'
          : toast.type === 'error'
          ? 'bg-red-950/40 border-red-900/60 text-red-200'
          : 'bg-gray-900 border-gray-800 text-gray-200'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
  </template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})

const supabase = useSupabaseClient()
const localePath = useLocalePath()
const { t } = useI18n()

const reports = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const updatingStatus = ref<Record<string, boolean>>({})

const toast = ref({
  show: false,
  message: '',
  type: 'success'
})

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

const { data: initialReports, pending, error: fetchError, refresh: fetchReports } = await useAsyncData('admin-reports', async () => {
  const { data, error } = await supabase
    .from('user_reports')
    .select('*')
    .order('created_at', { ascending: false })
    
  if (error) throw error
  return data || []
});

watch(initialReports, (newReports) => {
  if (newReports) {
    reports.value = newReports as any[]
  }
}, { immediate: true })

watch(pending, (val) => {
  loading.value = val
}, { immediate: true })

watch(fetchError, (err) => {
  if (err) {
    error.value = 'Failed to load reports.'
    console.error('Error fetching reports:', err)
  } else {
    error.value = null
  }
}, { immediate: true })

const updateStatus = async (report: any) => {
  updatingStatus.value[report.id] = true
  
  try {
    const { error: updateError } = await supabase
      .from('user_reports')
      .update({ status: report.status })
      .eq('id', report.id)
      
    if (updateError) throw updateError
    
    showToast(t('admin.reports.statusUpdated'), 'success')
  } catch (err: any) {
    console.error('Error updating status:', err)
    showToast(t('admin.reports.failedToUpdateStatus'), 'error')
    // Revert status on failure (simple reload for now)
    fetchReports()
  } finally {
    updatingStatus.value[report.id] = false
  }
}
</script>
