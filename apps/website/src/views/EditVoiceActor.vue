<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex justify-between items-center">
      <div>
        <h3 class="text-lg font-bold text-white">{{ isEditMode ? 'Edit Voice Actor Profile' : 'Create Voice Actor Profile' }}</h3>
        <p class="text-sm text-slate-400 mt-0.5">
          {{ isEditMode ? `Updating database entry ID #${id}` : 'Fill in profile fields to create a new voice actor entry.' }}
        </p>
      </div>
      <router-link
        to="/voice-actor-spreadsheet"
        class="text-xs font-semibold px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white rounded-xl border border-slate-700 transition-colors"
      >
        ← Back to Spreadsheet
      </router-link>
    </div>

    <!-- Main Workspace -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Profile Image Card (Left column) -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center space-y-5 h-fit shadow-xl">
        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block self-start">Profile Photo</label>
        <div class="relative h-44 w-44 rounded-full overflow-hidden border-2 border-slate-800 bg-slate-950 flex items-center justify-center text-slate-500 shadow-inner group">
          <img
            v-if="profilePicture"
            :src="profilePicture"
            class="h-full w-full object-cover"
            alt="Profile Picture"
          />
          <svg v-else class="h-14 w-14 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>

        <div class="w-full space-y-2">
          <button
            type="button"
            @click="triggerFileInput"
            class="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-semibold rounded-xl text-xs border border-slate-750 hover:border-slate-700 transition-all flex items-center justify-center space-x-2"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{{ previewImage ? 'Change Image' : 'Upload Image' }}</span>
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            @change="onProfilePictureChange"
            class="hidden"
          />
          <button
            v-if="previewImage"
            type="button"
            @click="clearImage"
            class="w-full py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-red-900/25 transition-all"
          >
            Reset image selection
          </button>
        </div>
        <p class="text-[10px] text-slate-500 leading-normal">
          Supported file formats: JPG, PNG, WEBP. Maximum file upload size: 5MB.
        </p>
      </div>

      <!-- Form (Right column) -->
      <form @submit.prevent="saveVoiceActor" class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <!-- First Name -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">First Name *</label>
            <input
              v-model="firstname"
              type="text"
              required
              placeholder="e.g. Richard"
              class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- Last Name -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Name *</label>
            <input
              v-model="lastname"
              type="text"
              required
              placeholder="e.g. Darbois"
              class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- Nationality -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nationality</label>
            <input
              v-model="nationality"
              type="text"
              placeholder="e.g. Français"
              class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- Date of birth -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date of Birth</label>
            <input
              v-model="dateOfBirth"
              type="date"
              class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- Awards -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Awards</label>
            <input
              v-model="awards"
              type="text"
              placeholder="e.g. Chevalier des Arts et des Lettres"
              class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- Years Active -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Years Active</label>
            <input
              v-model="yearsActive"
              type="text"
              placeholder="e.g. 1970 - présent"
              class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- TMDB ID -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">TMDB ID</label>
            <input
              v-model="tmdbId"
              type="number"
              placeholder="e.g. 10243"
              class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- Wikidata ID -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Wikidata ID</label>
            <input
              v-model="wikidataId"
              type="text"
              placeholder="e.g. Q3430691"
              class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <!-- Biography -->
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Biography</label>
          <textarea
            v-model="bio"
            rows="4"
            placeholder="Type profile biography details here..."
            class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
          ></textarea>
        </div>

        <!-- Social Media Links -->
        <div class="space-y-1">
          <div class="flex justify-between items-center">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Social Media Links (JSON format)</label>
            <span class="text-[10px] text-slate-500">e.g. {"facebook": "https://...", "twitter": "..."}</span>
          </div>
          <textarea
            v-model="socialMediaLinks"
            rows="3"
            placeholder='{ "instagram": "https://..." }'
            class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-mono resize-y"
          ></textarea>
        </div>

        <!-- Form Submit Bar -->
        <div class="flex justify-end pt-4 border-t border-slate-800/80">
          <button
            type="submit"
            :disabled="isSaving"
            class="py-3 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl text-sm shadow-lg transition-all duration-200 flex items-center justify-center"
          >
            <span v-if="isSaving" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
            <span>Save Profile</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Linked Works & Filmography (Bidirectional Linking) -->
    <div v-if="isEditMode" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
      <div class="flex justify-between items-center border-b border-slate-800 pb-3">
        <div>
          <h4 class="text-base font-bold text-white">Linked Works & Filmography</h4>
          <p class="text-xs text-slate-400">All dubbing credits linked to this voice actor profile.</p>
        </div>
        <router-link
          :to="`/add-voice-cast/${id}`"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1"
        >
          <span>+ Link New Work</span>
        </router-link>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-300">
          <thead class="bg-slate-950 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th class="px-4 py-3">Work ID</th>
              <th class="px-4 py-3">Media / Content ID</th>
              <th class="px-4 py-3">Type</th>
              <th class="px-4 py-3">Character</th>
              <th class="px-4 py-3">Performance</th>
              <th class="px-4 py-3 text-right">Edit Project</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            <tr v-for="work in linkedWorks" :key="work.id" class="hover:bg-slate-950/50 transition-colors">
              <td class="px-4 py-3 font-mono text-xs text-slate-400">#{{ work.id }}</td>
              <td class="px-4 py-3 font-mono text-xs text-blue-400">Project #{{ work.dubbing_project_id }}</td>
              <td class="px-4 py-3 uppercase text-[10px] font-bold tracking-wider text-slate-400">
                <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">{{ work.content_type || 'movie' }}</span>
              </td>
              <td class="px-4 py-3 font-medium text-white">{{ work.suggestions || 'Character' }}</td>
              <td class="px-4 py-3 text-xs text-slate-400">{{ work.performance || 'dialogues' }}</td>
              <td class="px-4 py-3 text-right">
                <router-link
                  :to="`/movies/edit/${work.dubbing_project_id}`"
                  class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-xs font-semibold rounded-lg border border-slate-700 transition-all inline-flex items-center space-x-1"
                >
                  <span>Edit Movie</span>
                  <span>↗</span>
                </router-link>
              </td>
            </tr>
            <tr v-if="linkedWorks.length === 0">
              <td colspan="6" class="text-center py-6 text-slate-500 text-xs">
                No linked works recorded for this voice actor yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Toast Notifications -->
    <div
      v-if="toast.show"
      class="fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl text-sm max-w-sm flex items-center space-x-3"
      :class="
        toast.type === 'success'
          ? 'bg-green-950/40 border-green-900/60 text-green-200'
          : toast.type === 'error'
          ? 'bg-red-950/40 border-red-900/60 text-red-200'
          : 'bg-slate-900 border-slate-800 text-slate-200'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "@/lib/supabase";

const route = useRoute();
const router = useRouter();
const id = route.params.id as string | undefined;
const isEditMode = computed(() => !!id && id !== "new");

// Form inputs
const firstname = ref("");
const lastname = ref("");
const bio = ref("");
const nationality = ref("");
const dateOfBirth = ref("");
const awards = ref("");
const yearsActive = ref("");
const socialMediaLinks = ref("");
const tmdbId = ref("");
const wikidataId = ref("");
const profilePicture = ref("");

// Upload properties
const profilePictureFile = ref<File | null>(null);
const previewImage = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const isSaving = ref(false);

const toast = ref({
  show: false,
  message: "",
  type: "info"
});

const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const clearImage = () => {
  if (fileInput.value) fileInput.value.value = "";
  profilePictureFile.value = null;
  previewImage.value = null;
};

const onProfilePictureChange = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    const file = files[0];
    profilePictureFile.value = file;

    // Create file reader object for thumbnail preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const uploadProfilePicture = async (voiceActorId: string | number) => {
  if (!profilePictureFile.value) return profilePicture.value;

  const formData = new FormData();
  formData.append("file", profilePictureFile.value);
  formData.append("voice_actor_id", String(voiceActorId));

  const response = await supabase.functions.invoke("upload_profile_picture", {
    body: formData,
  });

  const result = await response.data;
  if (result && result.ok) {
    return profilePictureFile.value.name;
  }
  return profilePicture.value;
};

const linkedWorks = ref<any[]>([]);

const fetchLinkedWorks = async () => {
  if (!isEditMode.value || !id) return;
  try {
    const { data, error } = await supabase
      .from("work")
      .select("*")
      .eq("voice_actor_id", id);
    if (error) throw error;
    linkedWorks.value = data || [];
  } catch (err) {
    console.error("Error loading linked works:", err);
  }
};

const fetchVoiceActor = async () => {
  if (!isEditMode.value || !id) return;

  try {
    const { data, error } = await supabase
      .from("voice_actors")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (data) {
      firstname.value = data.firstname;
      lastname.value = data.lastname;
      bio.value = data.bio || "";
      nationality.value = data.nationality || "";
      dateOfBirth.value = data.date_of_birth || "";
      awards.value = data.awards || "";
      yearsActive.value = data.years_active || "";
      socialMediaLinks.value = data.social_media_links ? JSON.stringify(data.social_media_links, null, 2) : "";
      tmdbId.value = data.tmdb_id || "";
      profilePicture.value = data.profile_picture || "";
      wikidataId.value = data.wikidata_id || "";
    }
    await fetchLinkedWorks();
  } catch (err: any) {
    console.error("Error loading voice actor profile:", err);
    showToast("Failed to load voice actor data from database.", "error");
  }
};

const saveVoiceActor = async () => {
  isSaving.value = true;
  const upsertData: any = {
    firstname: firstname.value,
    lastname: lastname.value,
    bio: bio.value || null,
    nationality: nationality.value || null,
    date_of_birth: dateOfBirth.value || null,
    awards: awards.value || null,
    years_active: yearsActive.value || null,
    social_media_links: null,
    profile_picture: profilePicture.value || null,
    tmdb_id: tmdbId.value ? Number(tmdbId.value) : null,
    wikidata_id: wikidataId.value || null,
  };

  // Parse social media links JSON
  if (socialMediaLinks.value.trim()) {
    try {
      upsertData.social_media_links = JSON.parse(socialMediaLinks.value);
    } catch (e) {
      showToast("Invalid JSON schema in Social Media Links", "error");
      isSaving.value = false;
      return;
    }
  }

  if (isEditMode.value && id) {
    upsertData.id = id;
  }

  try {
    const { data, error: upsertErr } = await supabase
      .from("voice_actors")
      .upsert([upsertData])
      .select();

    if (upsertErr) throw upsertErr;

    let voiceActorId = id;
    if (!isEditMode.value && data && data.length > 0) {
      voiceActorId = data[0].id;
    }

    // Upload profile picture if chosen
    if (profilePictureFile.value && voiceActorId) {
      await uploadProfilePicture(voiceActorId);
    }

    showToast("Voice actor profile saved successfully!", "success");

    // Redirect to spreadsheet after 1.5s
    setTimeout(() => {
      router.push("/voice-actor-spreadsheet");
    }, 1500);
  } catch (err: any) {
    console.error("Error saving voice actor profile:", err);
    showToast(err.message || "Failed to save voice actor.", "error");
  } finally {
    isSaving.value = false;
  }
};

onMounted(fetchVoiceActor);
</script>
