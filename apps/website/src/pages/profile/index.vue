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
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient();
const user = useSupabaseUser();

const username = ref(user.value?.user_metadata?.username || '');
const full_name = ref(user.value?.user_metadata?.full_name || '');
const isUpdating = ref(false);
const updateMessage = ref('');
const isError = ref(false);

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
</script>
