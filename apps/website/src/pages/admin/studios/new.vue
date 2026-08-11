<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex justify-between items-center shadow-xl">
      <div>
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <svg class="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h5" />
          </svg>
          {{ isEditMode ? 'Edit Studio Profile' : 'Create Dubbing Studio' }}
        </h3>
        <p class="text-sm text-gray-400 mt-1">
          {{ isEditMode ? `Updating studio record ID #${id}` : 'Fill in studio information, location, and website details.' }}
        </p>
      </div>
      <NuxtLink
        :to="localePath('/admin')"
        class="text-xs font-semibold px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl border border-gray-700 transition-colors"
      >
        ← Back to Dashboard
      </NuxtLink>
    </div>

    <!-- Main Form -->
    <form @submit.prevent="saveStudio" class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-xl">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Studio Name -->
        <div class="space-y-1 md:col-span-2">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Studio Name *</label>
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
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Country</label>
          <input
            v-model="country"
            type="text"
            placeholder="France"
            class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <!-- City -->
        <div class="space-y-1">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">City</label>
          <input
            v-model="city"
            type="text"
            placeholder="Paris / La Plaine Saint-Denis"
            class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <!-- Website URL -->
        <div class="space-y-1">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Website URL</label>
          <input
            v-model="websiteUrl"
            type="url"
            placeholder="https://www.dubbingbrothers.com"
            class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <!-- Logo URL -->
        <div class="space-y-1">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Logo URL</label>
          <input
            v-model="logoUrl"
            type="url"
            placeholder="https://..."
            class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      <!-- Description -->
      <div class="space-y-1">
        <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</label>
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
          <span>Save Studio Profile</span>
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

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

const supabase = useSupabaseClient();

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

const fetchStudio = async () => {
  if (!isEditMode.value || !id) return;
  try {
    const { data, error } = await supabase
      .from("studios")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (data) {
      name.value = data.name;
      description.value = data.description || "";
      country.value = data.country || "";
      city.value = data.city || "";
      websiteUrl.value = data.website_url || "";
      logoUrl.value = data.logo_url || "";
    }
  } catch (err: any) {
    console.error("Error loading studio:", err);
    showToast("Failed to load studio profile.", "error");
  }
};

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

    if (isEditMode.value && id) {
      const { error } = await supabase
        .from("studios")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("studios")
        .insert([payload]);
      if (error) throw error;
    }

    showToast("Studio saved successfully!", "success");
    setTimeout(() => {
      router.push(localePath("/admin"));
    }, 1200);
  } catch (err: any) {
    console.error("Error saving studio:", err);
    showToast(err.message || "Failed to save studio.", "error");
  } finally {
    isSaving.value = false;
  }
};

await fetchStudio();
</script>
