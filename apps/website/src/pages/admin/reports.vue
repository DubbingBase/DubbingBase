<template>
  <div class="space-y-6">
    <!-- Top toolbar -->
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 theme-surface-overlay p-5 rounded-2xl border theme-border"
    >
      <div>
        <h3 class="text-lg font-bold theme-text">
          {{ $t("admin.reports.title") }}
        </h3>
        <p class="text-sm theme-text-muted">
          {{ $t("admin.reports.description") }}
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <button
          @click="() => fetchReports()"
          :disabled="loading"
          class="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-[var(--app-color-surface-muted)] disabled:text-[var(--app-color-text-muted)] text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
        >
          <span
            v-if="loading"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></span>
          <span>{{ $t("common.refresh") }}</span>
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="p-4 theme-status-danger border border-[var(--app-color-danger-border)] rounded-xl flex items-center space-x-3 theme-status-danger-text text-sm"
    >
      <svg
        class="h-5 w-5 theme-status-danger-text shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Reports Table Card -->
    <div
      class="theme-surface-overlay border theme-border rounded-2xl overflow-hidden"
    >
      <!-- Loading indicator -->
      <div
        v-if="loading"
        class="flex flex-col items-center justify-center py-20 space-y-3"
      >
        <div
          class="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-500"
        ></div>
        <p class="theme-text-muted text-sm">
          {{ $t("admin.reports.fetchingReports") }}
        </p>
      </div>

      <!-- Empty state -->
      <div v-else-if="reports.length === 0" class="text-center py-16 space-y-2">
        <p class="theme-text-muted font-medium">
          {{ $t("admin.reports.noReportsFound") }}
        </p>
        <p class="text-xs theme-text-muted">
          {{ $t("admin.reports.everythingLooksGood") }}
        </p>
      </div>

      <!-- Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr
              class="border-b theme-border text-xs font-semibold theme-text-muted uppercase tracking-wider theme-surface-overlay"
            >
              <th class="py-4 px-6">{{ $t("admin.reports.details") }}</th>
              <th class="py-4 px-6">{{ $t("admin.reports.target") }}</th>
              <th class="py-4 px-6">{{ $t("admin.reports.reporter") }}</th>
              <th class="py-4 px-6">{{ $t("admin.reports.status") }}</th>
            </tr>
          </thead>
          <tbody class="divide-y theme-divide">
            <tr
              v-for="report in reports"
              :key="report.id"
              class="theme-hover-surface-muted transition-colors"
            >
              <td class="py-4 px-6">
                <div class="font-semibold theme-text">{{ report.reason }}</div>
                <div
                  class="text-xs theme-text-muted mt-1 max-w-sm truncate"
                  :title="report.details || ''"
                >
                  {{ report.details || $t("admin.reports.noDetailsProvided") }}
                </div>
                <div class="text-xs theme-text-muted mt-1">
                  {{ formatDate(report.created_at) }}
                </div>
              </td>
              <td class="py-4 px-6 font-mono text-xs theme-status-info-text">
                <NuxtLink
                  :to="localePath(report.target_url)"
                  target="_blank"
                  class="hover:underline flex items-center space-x-1"
                >
                  <svg
                    class="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  <span>{{ $t("common.link") }}</span>
                </NuxtLink>
              </td>
              <td class="py-4 px-6 text-xs theme-text-muted">
                {{ report.reporter_id }}
              </td>
              <td class="py-4 px-6">
                <select
                  v-model="report.status"
                  @change="updateStatus(report)"
                  :disabled="updatingStatus[report.id]"
                  class="theme-input border theme-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] disabled:opacity-50"
                  :class="{
                    'theme-status-warning-text': report.status === 'pending',
                    'theme-status-success-text': report.status === 'resolved',
                    'theme-text-muted': report.status === 'dismissed',
                  }"
                >
                  <option value="pending">
                    {{ $t("admin.reports.statusPending") }}
                  </option>
                  <option value="resolved">
                    {{ $t("admin.reports.statusResolved") }}
                  </option>
                  <option value="dismissed">
                    {{ $t("admin.reports.statusDismissed") }}
                  </option>
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
          ? 'theme-status-success border-[var(--app-color-success-border)] theme-status-success-text'
          : toast.type === 'error'
            ? 'theme-status-danger border-[var(--app-color-danger-border)] theme-status-danger-text'
            : 'theme-surface-overlay theme-border theme-text'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

definePageMeta({
  layout: "admin",
  middleware: "admin",
});

const supabase = useSupabaseClient();
const localePath = useLocalePath();
const { t } = useI18n();

const reports = ref<any[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const updatingStatus = ref<Record<string, boolean>>({});

const toast = ref({
  show: false,
  message: "",
  type: "success",
});

const showToast = (message: string, type: "success" | "error" = "success") => {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};

const {
  data: initialReports,
  pending,
  error: fetchError,
  refresh: fetchReports,
} = await useAsyncData("admin-reports", async () => {
  const { data, error } = await supabase
    .from("user_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
});

watch(
  initialReports,
  (newReports) => {
    if (newReports) {
      reports.value = newReports as any[];
    }
  },
  { immediate: true },
);

watch(
  pending,
  (val) => {
    loading.value = val;
  },
  { immediate: true },
);

watch(
  fetchError,
  (err) => {
    if (err) {
      error.value = "Failed to load reports.";
      console.error("Error fetching reports:", err);
    } else {
      error.value = null;
    }
  },
  { immediate: true },
);

const updateStatus = async (report: any) => {
  updatingStatus.value[report.id] = true;

  try {
    const { error: updateError } = await supabase
      .from("user_reports")
      .update({ status: report.status })
      .eq("id", report.id);

    if (updateError) throw updateError;

    showToast(t("admin.reports.statusUpdated"), "success");
  } catch (err: any) {
    console.error("Error updating status:", err);
    showToast(t("admin.reports.failedToUpdateStatus"), "error");
    // Revert status on failure (simple reload for now)
    fetchReports();
  } finally {
    updatingStatus.value[report.id] = false;
  }
};
</script>
