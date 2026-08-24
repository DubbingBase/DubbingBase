<template>
  <div class="min-h-screen bg-[#121212] text-[#e0e0e0] py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
    
    <!-- Optional: Confetti Container -->
    <div id="confetti-container" class="absolute inset-0 pointer-events-none z-50"></div>

    <div class="max-w-3xl mx-auto space-y-8">
      
      <!-- Header -->
      <div class="flex items-center gap-4">
        <NuxtLink :to="$localePath('/contribute')" class="text-[#a0a0a0] hover:text-white transition-colors p-2 rounded-full hover:bg-[#2a2a2a]">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </NuxtLink>
        <h1 class="text-3xl font-bold text-white capitalize">Enrich Data</h1>
      </div>

      <!-- Main Task Card -->
      <div class="bg-[#1d1d1d] rounded-2xl border border-[#2a2a2a] p-8 shadow-2xl relative">
        
        <!-- Loading State -->
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-12 space-y-4">
          <div class="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <p class="text-[#a0a0a0] animate-pulse">Finding a task for you...</p>
        </div>

        <!-- Error / No Tasks State -->
        <div v-else-if="error" class="text-center py-12 space-y-6">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 text-red-500">
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white mb-2">Oops!</h3>
            <p class="text-[#a0a0a0]">{{ error }}</p>
          </div>
          <button @click="loadTask" class="px-6 py-2 bg-[#2a2a2a] hover:bg-[#333] text-white rounded-lg transition-colors">
            Try Again
          </button>
        </div>

        <!-- Task Content -->
        <div v-else-if="currentTask" class="space-y-8">
          
          <div class="text-center space-y-2">
            <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Who is this?
            </h2>
            <p class="text-xl text-white">{{ currentTask.name || currentTask.title || (currentTask.firstname ? `${currentTask.firstname} ${currentTask.lastname || ''}`.trim() : null) || 'Unknown Entity' }}</p>
            <p class="text-sm text-[#a0a0a0]">Help us complete this profile by filling out what you know.</p>
          </div>

          <!-- Form Area -->
          <form class="space-y-6" @submit.prevent="submit">
            
            <!-- Voice Actor Fields -->
            <template v-if="activeCategory === 'enrich_voice_actor'">
              
              <div v-if="currentTask.profile_picture === null" class="space-y-2">
                <label class="block text-sm font-medium text-white">Profile Picture</label>
                <div 
                  class="border-2 border-dashed border-[#2a2a2a] rounded-xl p-8 text-center hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer relative"
                  @click="triggerFileInput"
                  @dragover.prevent="isDragging = true"
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="handleDrop"
                  :class="{'border-blue-500 bg-blue-500/10': isDragging}"
                >
                  <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileSelect">
                  <div v-if="previewUrl" class="space-y-4">
                    <img :src="previewUrl" class="max-h-48 mx-auto rounded-lg shadow-lg object-cover" />
                    <button type="button" @click.stop="clearFile" class="text-sm text-red-400 hover:text-red-300">Remove Image</button>
                  </div>
                  <div v-else class="space-y-4">
                    <div class="mx-auto w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[#a0a0a0]">
                      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <p class="text-sm text-[#a0a0a0]">Click or drop image</p>
                  </div>
                </div>
              </div>

              <div v-if="currentTask.nationality === null" class="space-y-2">
                <label class="block text-sm font-medium text-white">Nationality</label>
                <select v-model="formFields.nationality" class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                  <option value="" disabled>Select nationality</option>
                  <option value="Français">Français</option>
                  <option value="Belge">Belge</option>
                  <option value="Suisse">Suisse</option>
                  <option value="Québécois(e)">Québécois(e)</option>
                  <option value="Américain(e)">Américain(e)</option>
                  <option value="Britannique">Britannique</option>
                  <option value="Japonais(e)">Japonais(e)</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div v-if="currentTask.date_of_birth === null" class="space-y-2">
                <label class="block text-sm font-medium text-white">Date of Birth</label>
                <input v-model="formFields.date_of_birth" type="date" class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div v-if="currentTask.bio === null" class="space-y-2">
                <label class="block text-sm font-medium text-white">Biography</label>
                <textarea v-model="formFields.bio" rows="4" placeholder="Brief biography..." class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
              </div>

              <!-- External IDs -->
              <div class="space-y-4 pt-4 border-t border-[#2a2a2a]">
                <h3 class="text-lg font-medium text-white">External IDs</h3>
                
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-[#a0a0a0]">TMDB ID</label>
                  <input :value="currentTask.tmdb_id != null ? currentTask.tmdb_id : formFields.tmdb_id" @input="formFields.tmdb_id = ($event.target as HTMLInputElement).value" type="number" placeholder="e.g. 12345" class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentTask.tmdb_id != null" />
                </div>
                
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-[#a0a0a0]">Wikidata ID</label>
                  <input :value="currentTask.wikidata_id != null ? currentTask.wikidata_id : formFields.wikidata_id" @input="formFields.wikidata_id = ($event.target as HTMLInputElement).value" type="text" placeholder="e.g. Q12345" class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentTask.wikidata_id != null" />
                </div>
              </div>

              <!-- Social Links -->
              <div class="space-y-4 pt-4 border-t border-[#2a2a2a]">
                <h3 class="text-lg font-medium text-white">Social Links</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-[#a0a0a0]">Twitter/X</label>
                    <input :value="(currentTask.social_media_links?.twitter) || formFields.twitter" @input="formFields.twitter = ($event.target as HTMLInputElement).value" type="url" placeholder="https://x.com/..." class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentTask.social_media_links?.twitter != null" />
                  </div>
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-[#a0a0a0]">Instagram</label>
                    <input :value="(currentTask.social_media_links?.instagram) || formFields.instagram" @input="formFields.instagram = ($event.target as HTMLInputElement).value" type="url" placeholder="https://instagram.com/..." class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentTask.social_media_links?.instagram != null" />
                  </div>
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-[#a0a0a0]">TikTok</label>
                    <input :value="(currentTask.social_media_links?.tiktok) || formFields.tiktok" @input="formFields.tiktok = ($event.target as HTMLInputElement).value" type="url" placeholder="https://tiktok.com/@..." class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentTask.social_media_links?.tiktok != null" />
                  </div>
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-[#a0a0a0]">Facebook</label>
                    <input :value="(currentTask.social_media_links?.facebook) || formFields.facebook" @input="formFields.facebook = ($event.target as HTMLInputElement).value" type="url" placeholder="https://facebook.com/..." class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentTask.social_media_links?.facebook != null" />
                  </div>
                </div>
              </div>

            </template>

            <!-- Studio Fields -->
            <template v-if="activeCategory === 'enrich_studio'">
              
              <div v-if="currentTask.logo_url === null" class="space-y-2">
                <label class="block text-sm font-medium text-white">Studio Logo</label>
                <div 
                  class="border-2 border-dashed border-[#2a2a2a] rounded-xl p-8 text-center hover:border-purple-500/50 hover:bg-purple-500/5 transition-all cursor-pointer relative"
                  @click="triggerFileInput"
                  @dragover.prevent="isDragging = true"
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="handleDrop"
                  :class="{'border-purple-500 bg-purple-500/10': isDragging}"
                >
                  <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileSelect">
                  <div v-if="previewUrl" class="space-y-4">
                    <img :src="previewUrl" class="max-h-48 mx-auto rounded-lg shadow-lg object-contain" />
                    <button type="button" @click.stop="clearFile" class="text-sm text-red-400 hover:text-red-300">Remove Image</button>
                  </div>
                  <div v-else class="space-y-4">
                    <div class="mx-auto w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[#a0a0a0]">
                      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <p class="text-sm text-[#a0a0a0]">Click or drop logo</p>
                  </div>
                </div>
              </div>

              <div v-if="currentTask.country === null" class="space-y-2">
                <label class="block text-sm font-medium text-white">Country</label>
                <input v-model="formFields.country" type="text" placeholder="e.g. United States" class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>

              <div v-if="currentTask.city === null" class="space-y-2">
                <label class="block text-sm font-medium text-white">City</label>
                <input v-model="formFields.city" type="text" placeholder="e.g. Los Angeles" class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>

              <div v-if="currentTask.website_url === null" class="space-y-2">
                <label class="block text-sm font-medium text-white">Website URL</label>
                <input v-model="formFields.website_url" type="url" placeholder="https://..." class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>

              <!-- Social Links -->
              <div class="space-y-4 pt-4 border-t border-[#2a2a2a]">
                <h3 class="text-lg font-medium text-white">Social Links</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-[#a0a0a0]">Twitter/X</label>
                    <input :value="(currentTask.social_media_links?.twitter) || formFields.twitter" @input="formFields.twitter = ($event.target as HTMLInputElement).value" type="url" placeholder="https://x.com/..." class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentTask.social_media_links?.twitter != null" />
                  </div>
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-[#a0a0a0]">Instagram</label>
                    <input :value="(currentTask.social_media_links?.instagram) || formFields.instagram" @input="formFields.instagram = ($event.target as HTMLInputElement).value" type="url" placeholder="https://instagram.com/..." class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentTask.social_media_links?.instagram != null" />
                  </div>
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-[#a0a0a0]">TikTok</label>
                    <input :value="(currentTask.social_media_links?.tiktok) || formFields.tiktok" @input="formFields.tiktok = ($event.target as HTMLInputElement).value" type="url" placeholder="https://tiktok.com/@..." class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentTask.social_media_links?.tiktok != null" />
                  </div>
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-[#a0a0a0]">Facebook</label>
                    <input :value="(currentTask.social_media_links?.facebook) || formFields.facebook" @input="formFields.facebook = ($event.target as HTMLInputElement).value" type="url" placeholder="https://facebook.com/..." class="w-full bg-[#2a2a2a] border-none rounded-lg text-white px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentTask.social_media_links?.facebook != null" />
                  </div>
                </div>
              </div>

            </template>

            <!-- Actions -->
            <div class="flex items-center gap-4 pt-4 border-t border-[#2a2a2a]">
              <button 
                type="button"
                @click="loadTask" 
                class="flex-1 py-3 px-4 bg-[#2a2a2a] hover:bg-[#333] text-white rounded-xl font-medium transition-colors"
                :disabled="isSubmitting"
              >
                Skip Task
              </button>
              <button 
                type="submit" 
                class="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white rounded-xl font-medium shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                :disabled="!hasAnyInput || isSubmitting"
              >
                <svg v-if="isSubmitting" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{{ isSubmitting ? 'Submitting...' : 'Submit & Earn Points' }}</span>
              </button>
            </div>
          </form>

        </div>
      </div>
      
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { useContribute, fetchRandomTask } from '../../../composables/useContribute';

const { data: initialData } = await useAsyncData('random-task', () => fetchRandomTask('any'));

const initialTask = initialData.value?.task || null;
const initialCategory = initialData.value?.category || null;

const { getRandomTask, submitTask, currentTask, activeCategory, isLoading, isSubmitting, error } = useContribute(initialTask, initialCategory);

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);

const formFields = reactive<Record<string, string>>({
  nationality: '',
  date_of_birth: '',
  bio: '',
  country: '',
  city: '',
  website_url: '',
  tmdb_id: '',
  wikidata_id: '',
  twitter: '',
  instagram: '',
  tiktok: '',
  facebook: '',
});

const resetForm = () => {
  Object.keys(formFields).forEach(key => {
    formFields[key] = '';
  });
  clearFile();
};

const loadTask = async () => {
  resetForm();
  await getRandomTask('any');
};

const hasAnyInput = computed(() => {
  if (selectedFile.value) return true;
  return Object.values(formFields).some(val => val.trim() !== '');
});

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    setFile(target.files[0]);
  }
};

const handleDrop = (event: DragEvent) => {
  isDragging.value = false;
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    setFile(event.dataTransfer.files[0]);
  }
};

const setFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file.');
    return;
  }
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
};

const clearFile = () => {
  selectedFile.value = null;
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const playConfetti = () => {
  const container = document.getElementById('confetti-container');
  if (!container) return;
  
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'absolute w-3 h-3 bg-blue-500 rounded-sm';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.top = '-10px';
    confetti.style.backgroundColor = ['#3b82f6', '#8b5cf6', '#10b981', '#ef4444'][Math.floor(Math.random() * 4)];
    confetti.style.transition = 'all 2s ease-out';
    
    container.appendChild(confetti);
    
    setTimeout(() => {
      confetti.style.transform = `translate(${Math.random() * 200 - 100}px, 100vh) rotate(${Math.random() * 720}deg)`;
      confetti.style.opacity = '0';
    }, 50);
    
    setTimeout(() => {
      confetti.remove();
    }, 2000);
  }
};

const submit = async () => {
  if (!hasAnyInput.value || !currentTask.value || !activeCategory.value) return;
  
  const payload: Record<string, string | File | undefined> = {};
  if (selectedFile.value) payload.file = selectedFile.value;
  Object.keys(formFields).forEach(key => {
    if (formFields[key].trim() !== '') {
      payload[key] = formFields[key].trim();
    }
  });

  const result = await submitTask(activeCategory.value, currentTask.value.id.toString(), payload);
  if (result?.success) {
    playConfetti();
    setTimeout(() => {
      loadTask(); // Load next task
    }, 1500);
  }
};
</script>
