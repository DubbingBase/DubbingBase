<template>
  <div class="min-h-screen bg-[#121212] text-[#e0e0e0] py-8 px-4 sm:px-6 lg:px-8 font-sans">
    <div class="max-w-7xl mx-auto space-y-6">
      
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-bold text-white">Contribution Audit Logs</h1>
          <p class="text-[#a0a0a0]">Review gamified tasks and revert malicious edits.</p>
        </div>
        <button @click="loadLogs" class="p-2 bg-[#1d1d1d] hover:bg-[#2a2a2a] rounded-lg border border-[#2a2a2a] transition-colors text-[#a0a0a0] hover:text-white">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <!-- Grid Container -->
      <div class="h-[600px] w-full bg-[#1d1d1d] border border-[#2a2a2a] rounded-xl overflow-hidden relative" ref="gridContainer">
        <!-- RevoGrid component would typically be initialized here. We'll use a mocked UI for simplicity unless user provided specific Revogrid config -->
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-[#2a2a2a] text-xs uppercase text-[#a0a0a0] tracking-wider border-b border-[#333]">
              <th class="p-4 font-medium">Date</th>
              <th class="p-4 font-medium">User ID</th>
              <th class="p-4 font-medium">Action</th>
              <th class="p-4 font-medium">Points</th>
              <th class="p-4 font-medium">Status</th>
              <th class="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="text-sm divide-y divide-[#2a2a2a]">
            <tr v-for="log in logs" :key="log.id" class="hover:bg-[#222] transition-colors">
              <td class="p-4 text-[#a0a0a0]">{{ new Date(log.created_at).toLocaleString() }}</td>
              <td class="p-4 font-mono text-xs text-blue-400">{{ log.user_id.substring(0, 8) }}...</td>
              <td class="p-4">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400">
                  {{ log.action }}
                </span>
                <span class="text-[#a0a0a0] ml-2 text-xs">{{ log.entity_type }} ({{ log.entity_id }})</span>
              </td>
              <td class="p-4 text-emerald-400 font-mono">+{{ log.points_awarded }}</td>
              <td class="p-4">
                <span v-if="log.reverted_at" class="text-red-400 flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Reverted
                </span>
                <span v-else class="text-emerald-400 flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg> Applied
                </span>
              </td>
              <td class="p-4 text-right">
                <button 
                  v-if="!log.reverted_at"
                  @click="openRevertModal(log)" 
                  class="text-xs px-3 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded border border-red-500/20 transition-colors"
                >
                  Revert & Penalize
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="isLoading" class="absolute inset-0 bg-[#1d1d1d]/80 backdrop-blur-sm flex items-center justify-center">
          <div class="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      </div>
      
    </div>

    <!-- Revert Verification Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div class="bg-[#1d1d1d] rounded-2xl border border-[#2a2a2a] shadow-2xl max-w-2xl w-full p-6 space-y-6">
        <div>
          <h2 class="text-2xl font-bold text-white flex items-center gap-2">
            <svg class="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Revert Contribution
          </h2>
          <p class="text-[#a0a0a0] mt-1">This will revert the change and deduct {{ selectedLog?.points_awarded }} points from the user.</p>
        </div>

        <div v-if="conflictError" class="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg space-y-3">
          <p class="text-yellow-500 font-bold flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Conflict Detected (3-Way Verification)
          </p>
          <p class="text-sm text-yellow-200">The current value in the database does not match the value this user set. Someone else may have edited it since.</p>
          
          <div class="grid grid-cols-3 gap-4 text-xs font-mono mt-2">
            <div class="space-y-1">
              <span class="text-[#a0a0a0] uppercase block text-[10px]">Previous (Safe)</span>
              <div class="bg-[#121212] p-2 rounded border border-[#2a2a2a] break-all truncate">
                {{ conflictError.previousValue || 'null' }}
              </div>
            </div>
            <div class="space-y-1">
              <span class="text-[#a0a0a0] uppercase block text-[10px]">What they set</span>
              <div class="bg-[#121212] p-2 rounded border border-[#2a2a2a] break-all truncate">
                {{ conflictError.loggedValue || 'null' }}
              </div>
            </div>
            <div class="space-y-1">
              <span class="text-emerald-400 uppercase block text-[10px]">Current DB State</span>
              <div class="bg-[#121212] p-2 rounded border border-[#2a2a2a] break-all truncate">
                {{ conflictError.currentValue || 'null' }}
              </div>
            </div>
          </div>
          
          <div class="pt-3 border-t border-yellow-500/20">
            <label class="block text-sm text-white mb-2">Manual Resolution: What should the final value be?</label>
            <input v-model="resolvedValue" type="text" class="w-full bg-[#121212] border border-[#2a2a2a] rounded p-2 text-white focus:border-blue-500 focus:outline-none" placeholder="Enter the final correct value (or leave empty)">
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-[#2a2a2a]">
          <button @click="closeModal" class="px-4 py-2 text-[#a0a0a0] hover:text-white transition-colors">Cancel</button>
          <button 
            @click="confirmRevert" 
            class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            :disabled="isReverting"
          >
            <svg v-if="isReverting" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span v-if="conflictError">Force Resolve & Penalize</span>
            <span v-else>Confirm Revert</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const supabase = useSupabaseClient();
const logs = ref<any[]>([]);
const isLoading = ref(true);

const showModal = ref(false);
const selectedLog = ref<any>(null);
const isReverting = ref(false);
const conflictError = ref<any>(null);
const resolvedValue = ref<string>('');

const loadLogs = async () => {
  isLoading.value = true;
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (data) logs.value = data;
  isLoading.value = false;
};

onMounted(() => {
  loadLogs();
});

const openRevertModal = (log: any) => {
  selectedLog.value = log;
  conflictError.value = null;
  resolvedValue.value = '';
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  selectedLog.value = null;
  conflictError.value = null;
};

const confirmRevert = async () => {
  if (!selectedLog.value) return;
  isReverting.value = true;
  
  try {
    const payload: any = { auditLogId: selectedLog.value.id };
    
    // If we're resolving a conflict, send the forced value
    if (conflictError.value) {
      payload.force = true;
      payload.resolvedValue = resolvedValue.value;
    }
    
    const { data, error } = await supabase.functions.invoke('revert-task', {
      body: payload
    });
    
    if (error) throw error;
    
    if (data?.error === 'ERR_STATE_CHANGED') {
      conflictError.value = data;
      // Pre-fill with previous safe value
      resolvedValue.value = data.previousValue || '';
      return; // Stop here and let them see the conflict modal
    }
    
    if (data?.error) throw new Error(data.error);
    
    // Success
    closeModal();
    loadLogs();
    
  } catch (err) {
    console.error("Failed to revert", err);
    alert("Failed to revert. See console.");
  } finally {
    isReverting.value = false;
  }
};
</script>
