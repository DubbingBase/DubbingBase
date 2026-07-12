<template>
  <div class="space-y-6">
    <!-- Top toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
      <div>
        <h3 class="text-lg font-bold text-white">User Administration</h3>
        <p class="text-sm text-slate-400">View registered users, change roles, or delete accounts.</p>
      </div>
      <div class="w-full sm:w-80 relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by email..."
          class="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
        />
        <span class="absolute left-3.5 top-3 text-slate-500">
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
    <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <!-- Loading indicator -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 space-y-3">
        <div class="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-500"></div>
        <p class="text-slate-400 text-sm">Fetching users list...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredUsers.length === 0" class="text-center py-16 space-y-2">
        <p class="text-slate-400 font-medium">No users found</p>
        <p class="text-xs text-slate-500">Try adjusting your search criteria.</p>
      </div>

      <!-- Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/40">
              <th class="py-4 px-6">User details</th>
              <th class="py-4 px-6">User ID</th>
              <th class="py-4 px-6">Role</th>
              <th class="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-slate-800/10 transition-colors">
              <td class="py-4 px-6">
                <div class="font-semibold text-white">{{ user.email || 'Utilisateur anonyme' }}</div>
                <div class="text-xs text-slate-500">Registered: {{ formatDate(user.created_at) }}</div>
              </td>
              <td class="py-4 px-6 font-mono text-xs text-slate-400">
                {{ user.id }}
              </td>
              <td class="py-4 px-6">
                <select
                  v-model="userRole[user.id]"
                  @change="updateRole(user)"
                  :disabled="updatingRole[user.id]"
                  class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="user">Utilisateur</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td class="py-4 px-6 text-right">
                <button
                  @click="confirmDelete(user)"
                  class="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-red-900/25 hover:border-red-900/50 rounded-xl text-xs font-semibold transition-all"
                >
                  Supprimer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Confirm Delete Dialog (Modal) -->
    <div v-if="showConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div class="flex items-center space-x-3 text-red-400">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h4 class="text-lg font-bold">Confirmer la suppression</h4>
        </div>
        <p class="text-sm text-slate-300">
          Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur <strong class="text-white">{{ userToDelete?.email }}</strong> ? Cette action est irréversible.
        </p>
        <div class="flex justify-end space-x-3 pt-2">
          <button
            @click="showConfirm = false"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold border border-slate-700 transition-colors"
          >
            Annuler
          </button>
          <button
            @click="deleteUser"
            :disabled="deleting"
            class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-900/20 transition-all flex items-center space-x-2"
          >
            <span v-if="deleting" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            <span>Supprimer</span>
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
          : 'bg-slate-900 border-slate-800 text-slate-200'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { supabase } from "@/lib/supabase";

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

const fetchUsers = async () => {
  try {
    loading.value = true;
    error.value = null;

    const { data, error: funcError } = await supabase.functions.invoke("list_users");

    if (funcError) throw funcError;

    if (data && data.users) {
      users.value = data.users;
      userRole.value = {};
      for (const u of data.users) {
        userRole.value[u.id] = u.app_metadata?.role || "user";
      }
    }
  } catch (err: any) {
    console.error("Error fetching users:", err);
    error.value = err.message || "Failed to fetch users list.";
  } finally {
    loading.value = false;
  }
};

const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) return users.value;
  const q = searchQuery.value.toLowerCase().trim();
  return users.value.filter(u => u.email?.toLowerCase().includes(q));
});

const updateRole = async (userObj: User) => {
  const role = userRole.value[userObj.id];
  updatingRole.value[userObj.id] = true;

  try {
    const { error: funcError } = await supabase.functions.invoke("update_user_role", {
      body: { userId: userObj.id, role },
    });

    if (funcError) throw funcError;
    showToast(`Rôle mis à jour pour ${userObj.email} (${role})`, "success");
    await fetchUsers();
  } catch (err: any) {
    console.error("Error updating user role:", err);
    showToast(err.message || "Failed to update role", "error");
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
    const { error: funcError } = await supabase.functions.invoke("delete_user", {
      body: { userId: userToDelete.value.id },
    });

    if (funcError) throw funcError;

    showToast(`Utilisateur ${userToDelete.value.email} supprimé avec succès`, "success");
    showConfirm.value = false;
    userToDelete.value = null;
    await fetchUsers();
  } catch (err: any) {
    console.error("Error deleting user:", err);
    showToast(err.message || "Failed to delete user", "error");
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

onMounted(fetchUsers);
</script>
