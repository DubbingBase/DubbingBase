<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Profile Details</h2>
    
    <div class="space-y-6">
      <div v-if="user" class="bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-100 dark:border-white/5">
        <dl class="divide-y divide-gray-200 dark:divide-slate-800">
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
const user = useSupabaseUser();

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleString();
};
</script>
