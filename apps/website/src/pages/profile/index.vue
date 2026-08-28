<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Profile Details</h2>
    
    <div class="space-y-6">
      <div v-if="user" class="bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-100 dark:border-white/5">
        <form @submit.prevent="updateProfile" class="mb-6 space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username (Pseudo)</label>
              <input
                id="username"
                v-model="username"
                type="text"
                class="w-full px-4 py-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <div>
              <label for="full_name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
              <input
                id="full_name"
                v-model="full_name"
                type="text"
                class="w-full px-4 py-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>
          <div class="flex justify-end gap-3">
            <p v-if="updateMessage" :class="['mt-2 text-sm flex-1', isError ? 'text-red-500' : 'text-green-500']">
              {{ updateMessage }}
            </p>
            <button
              type="submit"
              :disabled="isUpdating || (username === (user.user_metadata?.username || '') && full_name === (user.user_metadata?.full_name || ''))"
              class="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isUpdating ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>

        <dl class="divide-y divide-gray-200 dark:divide-slate-800 border-t border-gray-200 dark:border-slate-800 pt-4">
          <div class="py-3 flex justify-between">
            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Email address</dt>
            <dd class="text-sm text-gray-900 dark:text-white">{{ user.email }}</dd>
          </div>
          <div class="py-3 flex justify-between">
            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">User ID</dt>
            <dd class="text-sm text-gray-900 dark:text-white font-mono text-xs">{{ user.id }}</dd>
          </div>
          <div class="py-3 flex justify-between">
            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last sign in</dt>
            <dd class="text-sm text-gray-900 dark:text-white">{{ formatDate(user.last_sign_in_at) }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Gamified Contributions Section -->
    <div class="mt-12">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Recent Contributions</h2>
      <div v-if="isLoadingLogs" class="text-sm text-gray-500">Loading contributions...</div>
      <div v-else-if="auditLogs.length === 0" class="text-sm text-gray-500">You haven't made any gamified contributions yet. Go to the <NuxtLink :to="localePath('/contribute')" class="text-cyan-500 hover:underline">Contribution Hub</NuxtLink> to start earning points!</div>
      <div v-else class="bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/5 overflow-hidden">
        <ul class="divide-y divide-gray-200 dark:divide-slate-800">
          <li v-for="log in auditLogs" :key="log.id" class="p-4 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white capitalize">
                {{ log.action.replace(/_/g, ' ') }} <span class="text-xs text-gray-500 dark:text-gray-400">on {{ log.entity_type }} ({{ log.entity_id }})</span>
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ new Date(log.created_at).toLocaleString() }}</p>
            </div>
            <div class="flex items-center gap-3">
              <span v-if="log.reverted_at" class="text-xs text-red-500 px-2 py-1 bg-red-500/10 rounded">Reverted</span>
              <span v-else class="text-sm font-mono text-emerald-500 font-bold">+{{ log.points_awarded }} pts</span>
            </div>
          </li>
        </ul>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const localePath = useLocalePath();

const username = ref(user.value?.user_metadata?.username || '');
const full_name = ref(user.value?.user_metadata?.full_name || '');
const isUpdating = ref(false);
const updateMessage = ref('');
const isError = ref(false);

const auditLogs = ref<any[]>([]);

const updateProfile = async () => {
  if (!username.value.trim()) {
    isError.value = true;
    updateMessage.value = 'Username cannot be empty';
    return;
  }

  isUpdating.value = true;
  updateMessage.value = '';
  
  const { error } = await supabase.auth.updateUser({
    data: { 
      username: username.value.trim(),
      full_name: full_name.value.trim() 
    }
  });

  isUpdating.value = false;

  if (error) {
    isError.value = true;
    updateMessage.value = error.message;
  } else {
    isError.value = false;
    updateMessage.value = 'Profile updated successfully!';
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleString();
};

const { data: auditLogsData, pending: isLoadingLogs } = await useAsyncData(
  'profile-audit-logs',
  async () => {
    if (!user.value) return [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) return [];
    return data || [];
  }
);

if (auditLogsData.value) {
  auditLogs.value = auditLogsData.value;
}
</script>
