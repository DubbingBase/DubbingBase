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

          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">URL du Logo</label>
            <input
              v-model="form.logo_url"
              type="url"
              class="w-full bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
              placeholder="https://..."
            />
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
import { ref, computed, onMounted } from 'vue';
import { useStudioData } from '@app/shared-logic';

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

const loading = ref(false);
const isSaving = ref(false);
const errorMsg = ref<string | null>(null);

onMounted(async () => {
  if (isEditMode.value) {
    loading.value = true;
    try {
      await loadStudioDetails(studioId);
      if (studio.value) {
        form.value = {
          name: studio.value.name || '',
          country: studio.value.country || '',
          city: studio.value.city || '',
          website_url: studio.value.website_url || '',
          logo_url: studio.value.logo_url || '',
          description: studio.value.description || ''
        };
      }
    } catch (err) {
      console.error(err);
      errorMsg.value = "Impossible de charger les détails du studio.";
    } finally {
      loading.value = false;
    }
  }
});

const saveStudio = async () => {
  if (!form.value.name.trim()) return;
  
  isSaving.value = true;
  errorMsg.value = null;

  try {
    const payload = {
      id: isEditMode.value ? studioId : null,
      updates: {
        name: form.value.name.trim(),
        description: form.value.description.trim() || null,
        country: form.value.country.trim() || null,
        city: form.value.city.trim() || null,
        website_url: form.value.website_url.trim() || null,
        logo_url: form.value.logo_url.trim() || null,
      },
      isEditMode: isEditMode.value,
    };

    const { error } = await supabase.functions.invoke("save-studio", {
      body: payload
    });

    if (error) throw error;

    router.push(localePath(`/studio/${isEditMode.value ? studioId : ''}`));
  } catch (err: any) {
    console.error("Error saving studio:", err);
    errorMsg.value = err.message || "Une erreur s'est produite lors de la sauvegarde.";
  } finally {
    isSaving.value = false;
  }
};
</script>
