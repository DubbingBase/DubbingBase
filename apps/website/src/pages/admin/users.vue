<template>
  <div class="space-y-6">
    <!-- Top toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-900 p-5 rounded-2xl border border-gray-800">
      <div>
        <h3 class="text-lg font-bold text-white">{{ $t('admin.users.title') }}</h3>
        <p class="text-sm text-gray-400">{{ $t('admin.users.description') }}</p>
      </div>
      <div class="w-full sm:w-80 relative">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="$t('admin.users.searchPlaceholder')"
          class="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
        />
        <span class="absolute left-3.5 top-3 text-gray-500">
          <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-center space-x-3 text-red-200 text-sm">
      <svg class="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Users Table Card -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <!-- Loading indicator -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 space-y-3">
        <div class="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-500"></div>
        <p class="text-gray-400 text-sm">{{ $t('admin.users.fetchingUsers') }}</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredUsers.length === 0" class="text-center py-16 space-y-2">
        <p class="text-gray-400 font-medium">{{ $t('admin.users.noUsersFound') }}</p>
        <p class="text-xs text-gray-500">{{ $t('admin.users.tryAdjustingSearch') }}</p>
      </div>

      <!-- Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-900/40">
              <th class="py-4 px-6">{{ $t('admin.users.userDetails') }}</th>
              <th class="py-4 px-6">{{ $t('common.userId') }}</th>
              <th class="py-4 px-6">{{ $t('admin.users.role') }}</th>
              <th class="py-4 px-6 text-right">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800/60">
            <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-gray-800/10 transition-colors">
              <td class="py-4 px-6">
                <div class="font-semibold text-white">{{ user.email || $t('admin.users.anonymousUser') }}</div>
                <div class="text-xs text-gray-500">{{ $t('admin.users.registered') }} {{ formatDate(user.created_at) }}</div>
              </td>
              <td class="py-4 px-6 font-mono text-xs text-gray-400">
                {{ user.id }}
              </td>
              <td class="py-4 px-6">
                <select
                  v-model="userRole[user.id]"
                  @change="updateRole(user)"
                  :disabled="updatingRole[user.id]"
                  class="bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="user">{{ $t('admin.users.roleUser') }}</option>
                  <option value="admin">{{ $t('admin.users.roleAdmin') }}</option>
                </select>
              </td>
              <td class="py-4 px-6 text-right">
                <button
                  @click="confirmDelete(user)"
                  class="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-red-900/25 hover:border-red-900/50 rounded-xl text-xs font-semibold transition-all"
                >
                  {{ $t('admin.users.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Confirm Delete Dialog (Modal) -->
    <div v-if="showConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/85 backdrop-blur-md">
      <div class="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div class="flex items-center space-x-3 text-red-400">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h4 class="text-lg font-bold">{{ $t('admin.users.confirmDelete') }}</h4>
        </div>
        <p class="text-sm text-gray-300">
          {{ $t('admin.users.confirmDeleteMessage', { email: userToDelete?.email }) }}
        </p>
        <div class="flex justify-end space-x-3 pt-2">
          <button
            @click="showConfirm = false"
            class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-semibold border border-gray-700 transition-colors"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="deleteUser"
            :disabled="deleting"
            class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-900/20 transition-all flex items-center space-x-2"
          >
            <span v-if="deleting" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            <span>{{ $t('common.delete') }}</span>
          </button>
        </div>
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

const { t } = useI18n();




definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

import { ref, onMounted, computed } from "vue";

interface User {
  id: string;
  email: string;
  created_at: string;
  app_metadata: {
    role?: string;
    [key: string]: any;
  };
}

const users = ref<User[]>([]);
const userRole = ref<Record<string, string>>({});
const searchQuery = ref("");
const loading = ref(true);
const error = ref<string | null>(null);

// Pending UI action states
const updatingRole = ref<Record<string, boolean>>({});
const showConfirm = ref(false);
const userToDelete = ref<User | null>(null);
const deleting = ref(false);

const toast = ref({
  show: false,
  message: "",
  type: "info"
});

const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

const { data: initialUsers, pending, error: fetchError, refresh: fetchUsers } = await useAsyncData('admin-users', async () => {
  const data = await $fetch('/api/list_users');
  return data?.users || [];
});

watch(initialUsers, (newUsers) => {
  if (newUsers) {
    users.value = newUsers;
    userRole.value = {};
    for (const u of newUsers) {
      userRole.value[u.id] = u.app_metadata?.role || "user";
    }
  }
}, { immediate: true });

watch(pending, (val) => {
  loading.value = val;
}, { immediate: true });

if (fetchError.value) {
  error.value = fetchError.value.message;
}

const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) return users.value;
  const q = searchQuery.value.toLowerCase().trim();
  return users.value.filter(u => u.email?.toLowerCase().includes(q));
});

const updateRole = async (userObj: User) => {
  const role = userRole.value[userObj.id];
  updatingRole.value[userObj.id] = true;

  try {
    await $fetch('/api/update_user_role', {
      method: 'POST',
      body: { userId: userObj.id, role },
    });

    showToast(t('admin.users.roleUpdated', { email: userObj.email, role }), "success");
    await fetchUsers();
  } catch (err: any) {
    console.error("Error updating user role:", err);
    showToast(err.message || t('admin.users.failedToUpdateRole'), "error");
  } finally {
    updatingRole.value[userObj.id] = false;
  }
};

const confirmDelete = (userObj: User) => {
  userToDelete.value = userObj;
  showConfirm.value = true;
};

const deleteUser = async () => {
  if (!userToDelete.value) return;
  deleting.value = true;

  try {
    await $fetch('/api/delete_user', {
      method: 'POST',
      body: { userId: userToDelete.value.id },
    });

    showToast(t('admin.users.userDeleted', { email: userToDelete.value.email }), "success");
    showConfirm.value = false;
    userToDelete.value = null;
    await fetchUsers();
  } catch (err: any) {
    console.error("Error deleting user:", err);
    showToast(err.message || t('admin.users.failedToDeleteUser'), "error");
  } finally {
    deleting.value = false;
  }
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return dateStr;
  }
};

</script>
