<template>
  <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl mt-6">
    <div class="flex justify-between items-center border-b border-slate-800 pb-3">
      <div>
        <h4 class="text-base font-bold text-white">Import Works from Wikipedia (Mistral AI)</h4>
        <p class="text-xs text-slate-400">Extract filmography directly from a Wikipedia page URL and match it to our database.</p>
      </div>
    </div>

    <!-- Input Section -->
    <div class="flex space-x-4">
      <input
        v-model="wikipediaUrl"
        type="url"
        placeholder="https://fr.wikipedia.org/wiki/..."
        class="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      <button
        @click="extractWorks"
        :disabled="isExtracting || !wikipediaUrl"
        class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl text-sm shadow-md transition-all flex items-center space-x-2"
      >
        <span v-if="isExtracting" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
        <span>{{ isExtracting ? 'Extracting...' : 'Extract Works' }}</span>
      </button>
    </div>

    <div v-if="error" class="p-4 rounded-xl bg-red-950/40 border border-red-900/60 text-red-200 text-sm">
      {{ error }}
    </div>

    <!-- Diff View Table -->
    <div v-if="extractedWorks.length > 0" class="overflow-x-auto mt-4">
      <div class="mb-4 flex justify-between items-center">
        <h5 class="text-sm font-bold text-white">Extracted Works ({{ extractedWorks.length }})</h5>
        <button
          @click="importSelectedWorks"
          :disabled="isImporting || selectedIndices.length === 0"
          class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1"
        >
          <span v-if="isImporting" class="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>
          <span>Import Selected ({{ selectedIndices.length }})</span>
        </button>
      </div>

      <table class="w-full text-left text-sm text-slate-300">
        <thead class="bg-slate-950 text-[10px] font-semibold uppercase text-slate-400 border-b border-slate-800">
          <tr>
            <th class="px-3 py-2 w-10 text-center">
              <input type="checkbox" @change="toggleAll" :checked="selectedIndices.length === extractedWorks.length && extractedWorks.length > 0" class="rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-900" />
            </th>
            <th class="px-3 py-2">French Title</th>
            <th class="px-3 py-2">Original Title</th>
            <th class="px-3 py-2">Character</th>
            <th class="px-3 py-2">Original Actor</th>
            <th class="px-3 py-2">Type</th>
            <th class="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60 text-xs">
          <tr v-for="(work, index) in extractedWorks" :key="index" class="hover:bg-slate-950/50 transition-colors">
            <td class="px-3 py-2 text-center">
              <input type="checkbox" :value="index" v-model="selectedIndices" class="rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-900" />
            </td>
            <td class="px-3 py-2 font-medium text-white">{{ work.frenchTitle }}</td>
            <td class="px-3 py-2 text-slate-400">{{ work.originalTitle || '-' }}</td>
            <td class="px-3 py-2 text-slate-400">{{ work.character || '-' }}</td>
            <td class="px-3 py-2 text-slate-400">{{ work.originalActor || '-' }}</td>
            <td class="px-3 py-2 uppercase tracking-wider text-[10px]">
               <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">{{ work.type || 'unknown' }}</span>
            </td>
            <td class="px-3 py-2">
              <span v-if="isExistingWork(work)" class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-950 text-green-400 border border-green-900">Exists</span>
              <span v-else class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-400 border border-blue-900">New</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps<{
  voiceActorId: string | number;
}>();

const supabase = useSupabaseClient();
const wikipediaUrl = ref('');
const isExtracting = ref(false);
const isImporting = ref(false);
const error = ref('');
const extractedWorks = ref<any[]>([]);
const existingWorks = ref<any[]>([]);
const selectedIndices = ref<number[]>([]);

// Fetch existing works to compare against
const fetchExistingWorks = async () => {
  try {
    const { data, error: err } = await supabase
      .from('work')
      .select('*, dubbing_projects(*)')
      .eq('voice_actor_id', props.voiceActorId);
    
    if (err) throw err;
    existingWorks.value = data || [];
  } catch (err: any) {
    console.error('Error fetching existing works:', err);
  }
};

onMounted(() => {
  fetchExistingWorks();
});

const isExistingWork = (extracted: any) => {
  // Simple heuristic matching for now. 
  // In reality, this would need to compare extracted frenchTitle to dubbing_projects titles.
  return existingWorks.value.some(ew => 
    ew.performance?.toLowerCase() === extracted.character?.toLowerCase()
  );
};

const extractWorks = async () => {
  if (!wikipediaUrl.value) return;
  isExtracting.value = true;
  error.value = '';
  extractedWorks.value = [];
  selectedIndices.value = [];

  try {
    const data = await $fetch("/api/extract-voice-actor-works", {
      method: "POST",
      body: { wikipediaUrl: wikipediaUrl.value }
    });

    if (!(data as any).ok) throw new Error((data as any).error);

    extractedWorks.value = (data as any).result || [];
  } catch (err: any) {
    error.value = err.message || 'Failed to extract works';
  } finally {
    isExtracting.value = false;
  }
};

const toggleAll = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    selectedIndices.value = extractedWorks.value.map((_, i) => i);
  } else {
    selectedIndices.value = [];
  }
};

const importSelectedWorks = async () => {
  isImporting.value = true;
  error.value = '';
  
  const toImport = selectedIndices.value.map(i => extractedWorks.value[i]);
  
  // Here we would implement the "cascade create" logic.
  // Since we don't have all the exact edge functions/APIs to stub movies and actors ready,
  // we will placeholder this logic. 
  // Normally:
  // 1. Loop through toImport
  // 2. Try to find dubbing_project by title. If not found, create it (with a stub).
  // 3. Try to find actor by name. If not found, create it.
  // 4. Create the `work` row linking the two + the voice actor.

  try {
    // TODO: implement cascade create and insert into `work` table.
    alert('Import Logic (Cascade Create) would run here for ' + toImport.length + ' items.');
    
    // Clear selection after fake import
    selectedIndices.value = [];
    await fetchExistingWorks();
  } catch(err: any) {
    error.value = err.message || 'Failed to import works';
  } finally {
    isImporting.value = false;
  }
};
</script>
