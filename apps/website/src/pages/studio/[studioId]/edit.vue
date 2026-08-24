<template>
  <div class="bg-gray-50 dark:bg-[#1b1b1b] min-h-screen text-gray-900 dark:text-white py-12 px-4">
    <div class="max-w-3xl mx-auto">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold">{{ isEditMode ? 'Éditer le studio' : 'Créer un studio' }}</h1>
          <p class="text-gray-500 dark:text-gray-400 mt-2">
            Remplissez les informations ci-dessous pour {{ isEditMode ? 'mettre à jour' : 'créer' }} le studio.
          </p>
        </div>
        <NuxtLink
          :to="isEditMode ? $localePath(`/studio/${studioId}`) : $localePath('/studios')"
          class="px-4 py-2 bg-gray-200 dark:bg-[#2a2a2a] hover:bg-gray-300 dark:hover:bg-[#333] rounded-lg transition-colors text-sm font-medium"
        >
          Annuler
        </NuxtLink>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>

      <form v-else @submit.prevent="saveStudio" class="bg-white dark:bg-[#1d1d1d] rounded-2xl p-6 md:p-8 border border-gray-200 dark:border-[#2a2a2a] shadow-sm">
        <div class="space-y-6">
          
          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Nom du studio *</label>
            <input
              v-model="form.name"
              type="text"
              required
              class="w-full bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
              placeholder="Ex: Dubbing Brothers"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Pays</label>
              <input
                v-model="form.country"
                type="text"
                class="w-full bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                placeholder="Ex: France"
              />
            </div>
            <div>
              <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Ville</label>
              <input
                v-model="form.city"
                type="text"
                class="w-full bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                placeholder="Ex: Paris"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Site Web</label>
            <input
              v-model="form.website_url"
              type="url"
              class="w-full bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
              placeholder="https://..."
            />
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Logo du studio</label>
            <div class="flex items-center gap-4">
              <div class="relative h-16 w-16 rounded-xl overflow-hidden border border-gray-200 dark:border-[#2a2a2a] bg-gray-50 dark:bg-[#161616] flex shrink-0 items-center justify-center text-gray-500 shadow-inner group">
                <NuxtImg format="webp" v-if="logoPreview || form.logo_url"
                  :src="logoPreview || form.logo_url"
                  class="h-full w-full object-cover"
                  alt="Logo du Studio"
                />
                <svg v-else class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="flex-1 space-y-2">
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  @change="onLogoChange"
                  class="hidden"
                />
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="triggerFileInput"
                    class="py-2 px-4 bg-gray-200 dark:bg-[#2a2a2a] hover:bg-gray-300 dark:hover:bg-[#333] text-gray-900 dark:text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {{ logoPreview ? 'Changer de Logo' : 'Uploader un Logo' }}
                  </button>
                  <button
                    v-if="logoPreview || form.logo_url"
                    type="button"
                    @click="clearLogo"
                    class="py-2 px-4 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              v-model="form.description"
              rows="5"
              class="w-full bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors resize-y"
              placeholder="Description ou historique du studio..."
            ></textarea>
          </div>
        </div>

        <div v-if="errorMsg" class="mt-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800">
          {{ errorMsg }}
        </div>

        <div class="mt-8 flex justify-end">
          <button
            type="submit"
            :disabled="isSaving || !form.name"
            class="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <span v-if="isSaving" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            {{ isSaving ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
        </div>
      </form>
    </div>
  </div>
  </template>

<script setup lang="ts">
defineRouteRules({
  swr: false,
  cache: false
});

import { ref, computed, onMounted } from 'vue';
import { useStudioData } from '@app/shared-logic';
import imageCompression from "browser-image-compression";

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const supabase = useSupabaseClient();
const { studio, loading: fetchingData, loadStudioDetails } = useStudioData(supabase);

const studioId = route.params.studioId as string;
const isEditMode = computed(() => studioId && studioId !== 'new');

const form = ref({
  name: '',
  country: '',
  city: '',
  website_url: '',
  logo_url: '',
  description: ''
});

const logoFile = ref<File | null>(null);
const logoPreview = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileInput = () => {
  fileInput.value?.click();
};

const clearLogo = () => {
  if (fileInput.value) fileInput.value.value = "";
  logoFile.value = null;
  logoPreview.value = null;
  form.value.logo_url = "";
};

const onLogoChange = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    const file = files[0];
    logoFile.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      logoPreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const loading = ref(false);
const isSaving = ref(false);
const errorMsg = ref<string | null>(null);

const { data: initialStudio } = await useAsyncData(`studio-edit-${studioId}`, async () => {
  if (!isEditMode.value) return null;
  const { data, error } = await supabase.from('studios').select('*').eq('id', studioId).single();
  if (error) throw error;
  return data;
});

watch(initialStudio, (data) => {
  if (data) {
    form.value = {
      name: data.name || '',
      country: data.country || '',
      city: data.city || '',
      website_url: data.website_url || '',
      logo_url: data.logo_url || '',
      description: data.description || ''
    };
  }
}, { immediate: true });

const saveStudio = async () => {
  if (!form.value.name.trim()) return;
  
  isSaving.value = true;
  errorMsg.value = null;

  try {
    let finalLogoUrl = form.value.logo_url.trim() || null;
    if (logoFile.value) {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true };
      const compressedFile = await imageCompression(logoFile.value, options);
      const fileExt = logoFile.value.name.split('.').pop() || 'jpg';
      const actualStudioId = isEditMode.value ? studioId : 'temp_' + Date.now();
      const filePath = `${actualStudioId}/${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("studio_logos")
        .upload(filePath, compressedFile, { cacheControl: "3600", upsert: true });
        
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from("studio_logos").getPublicUrl(filePath);
        if (publicUrlData) {
          finalLogoUrl = publicUrlData.publicUrl;
        }
      } else {
        console.error("Logo upload error:", uploadError);
      }
    }

    const payload = {
      id: isEditMode.value ? studioId : null,
      updates: {
        name: form.value.name.trim(),
        description: form.value.description.trim() || null,
        country: form.value.country.trim() || null,
        city: form.value.city.trim() || null,
        website_url: form.value.website_url.trim() || null,
        logo_url: finalLogoUrl,
      },
      isEditMode: isEditMode.value,
    };

    await $fetch("/api/save-studio", {
      method: "POST",
      body: payload
    });

    router.push(localePath(`/studio/${isEditMode.value ? studioId : ''}`));
  } catch (err: any) {
    console.error("Error saving studio:", err);
    errorMsg.value = err.message || "Une erreur s'est produite lors de la sauvegarde.";
  } finally {
    isSaving.value = false;
  }
};
</script>
