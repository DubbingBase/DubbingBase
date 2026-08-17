<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex justify-between items-center shadow-xl">
      <div>
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <svg class="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h5" />
          </svg>
          {{ isEditMode ? $t('admin.studios.editStudioProfile') : $t('admin.studios.createDubbingStudio') }}
        </h3>
        <p class="text-sm text-gray-400 mt-1">
          {{ isEditMode ? $t('admin.studios.updatingStudioRecord', { id }) : $t('admin.studios.fillStudioInfo') }}
        </p>
      </div>
      <NuxtLink
        :to="localePath('/admin')"
        class="text-xs font-semibold px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl border border-gray-700 transition-colors"
      >
        {{ $t('common.backToDashboard') }}
      </NuxtLink>
    </div>

    <!-- Main Form -->
    <form @submit.prevent="saveStudio" class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-xl">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Studio Name -->
        <div class="space-y-1 md:col-span-2">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ $t('admin.studios.studioName') }} *</label>
          <input
            v-model="name"
            type="text"
            required
            placeholder="e.g. Dubbing Brothers"
            class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <!-- Country -->
        <div class="space-y-1">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ $t('common.country') }}</label>
          <input
            v-model="country"
            type="text"
            placeholder="France"
            class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <!-- City -->
        <div class="space-y-1">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ $t('common.city') }}</label>
          <input
            v-model="city"
            type="text"
            placeholder="Paris / La Plaine Saint-Denis"
            class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <!-- Website URL -->
        <div class="space-y-1">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ $t('admin.studios.websiteUrl') }}</label>
          <input
            v-model="websiteUrl"
            type="url"
            placeholder="https://www.dubbingbrothers.com"
            class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <!-- Studio Logo -->
        <div class="space-y-2">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider block">{{ $t('admin.studios.studioLogo') }}</label>
          <div class="flex items-center gap-4">
            <div class="relative h-16 w-16 rounded-xl overflow-hidden border border-gray-800 bg-gray-950 flex shrink-0 items-center justify-center text-gray-500 shadow-inner group">
              <NuxtImg format="webp" v-if="logoPreview || logoUrl"
                :src="logoPreview || logoUrl"
                class="h-full w-full object-cover"
                alt="Studio Logo"
              />
              <svg v-else class="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  class="py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg transition-colors border border-gray-700"
                >
                  {{ logoPreview ? $t('admin.studios.changeLogo') : $t('admin.studios.uploadLogo') }}
                </button>
                <button
                  v-if="logoPreview || logoUrl"
                  type="button"
                  @click="clearLogo"
                  class="py-2 px-3 bg-red-950/30 hover:bg-red-950/50 text-red-400 text-xs font-semibold rounded-lg transition-colors border border-red-900/30"
                >
                  {{ $t('common.remove') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div class="space-y-1">
        <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ $t('common.description') }}</label>
        <textarea
          v-model="description"
          rows="4"
          placeholder="Studio description and historical details..."
          class="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
        ></textarea>
      </div>

      <!-- Submit Bar -->
      <div class="flex justify-end pt-4 border-t border-gray-800/80">
        <button
          type="submit"
          :disabled="isSaving"
          class="py-3 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm shadow-lg transition-all flex items-center justify-center space-x-2"
        >
          <span v-if="isSaving" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
          <span>{{ $t('admin.studios.saveStudioProfile') }}</span>
        </button>
      </div>
    </form>

    <!-- Toast Notification -->
    <div
      v-if="toast.show"
      class="fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl text-sm max-w-sm flex items-center space-x-3"
      :class="
        toast.type === 'success'
          ? 'bg-green-950/80 border-green-800 text-green-200'
          : toast.type === 'error'
          ? 'bg-red-950/80 border-red-800 text-red-200'
          : 'bg-gray-900 border-gray-800 text-gray-200'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
  </template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import imageCompression from "browser-image-compression";

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

const supabase = useSupabaseClient();
const { t } = useI18n();

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const id = route.params.id as string | undefined;
const isEditMode = computed(() => !!id && id !== "new");

const name = ref("");
const description = ref("");
const country = ref("");
const city = ref("");
const websiteUrl = ref("");
const logoUrl = ref("");
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
  logoUrl.value = "";
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
const isSaving = ref(false);

const toast = ref({
  show: false,
  message: "",
  type: "info" as "success" | "error" | "info"
});

const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

const { data: initialData } = await useAsyncData(`studio-${id}`, async () => {
  if (!isEditMode.value || !id) return null;
  const { data, error } = await supabase
    .from("studios")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
});

watch(initialData, (data) => {
  if (data) {
    name.value = data.name;
    description.value = data.description || "";
    country.value = data.country || "";
    city.value = data.city || "";
    websiteUrl.value = data.website_url || "";
    logoUrl.value = data.logo_url || "";
  }
}, { immediate: true });

const saveStudio = async () => {
  if (!name.value.trim()) return;
  isSaving.value = true;
  try {
    const payload = {
      name: name.value.trim(),
      description: description.value || null,
      country: country.value || null,
      city: city.value || null,
      website_url: websiteUrl.value || null,
      logo_url: logoUrl.value || null
    };

    let studioId = id;

    if (isEditMode.value && id) {
      const { error } = await supabase
        .from("studios")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("studios")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      studioId = data.id.toString();
    }

    if (logoFile.value && studioId) {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true };
      const compressedFile = await imageCompression(logoFile.value, options);
      const fileExt = logoFile.value.name.split('.').pop() || 'jpg';
      const filePath = `${studioId}/${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("studio_logos")
        .upload(filePath, compressedFile, { cacheControl: "3600", upsert: true });
        
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from("studio_logos").getPublicUrl(filePath);
        if (publicUrlData) {
          await supabase.from("studios").update({ logo_url: publicUrlData.publicUrl }).eq("id", studioId);
        }
      } else {
        console.error("Logo upload error:", uploadError);
      }
    }

    showToast(t('admin.studios.studioSaved'), "success");
    setTimeout(() => {
      router.push(localePath("/admin"));
    }, 1200);
  } catch (err: any) {
    console.error("Error saving studio:", err);
    showToast(err.message || t('admin.studios.failedToSave'), "error");
  } finally {
    isSaving.value = false;
  }
};

</script>
