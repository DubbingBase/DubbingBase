<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex justify-between items-center">
      <div>
        <h3 class="text-lg font-bold text-white">{{ isEditMode ? 'Edit Voice Actor Profile' : 'Create Voice Actor Profile' }}</h3>
        <p class="text-sm text-gray-400 mt-0.5">
          {{ isEditMode ? `Updating database entry ID #${id}` : 'Fill in profile fields to create a new voice actor entry.' }}
        </p>
      </div>
      <NuxtLink
        :to="localePath(id ? `/voice-actor/${id}` : '/')"
        class="text-xs font-semibold px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-350 hover:text-white rounded-xl border border-gray-700 transition-colors"
      >
        ← {{ id ? 'Back to Voice Actor' : 'Back Home' }}
      </NuxtLink>
    </div>

    <!-- Main Workspace -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Profile Image Card (Left column) -->
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center text-center space-y-5 h-fit shadow-xl">
        <label class="text-xs font-bold text-gray-400 uppercase tracking-wider block self-start">Profile Photo</label>
        <div class="relative h-44 w-44 rounded-full overflow-hidden border-2 border-gray-800 bg-gray-950 flex items-center justify-center text-gray-500 shadow-inner group">
          <img v-if="previewImage"
            :src="previewImage"
            class="h-full w-full object-cover"
            alt="Profile Picture Preview"
          />
          <NuxtImg format="webp" v-else-if="resolvedProfilePicture"
            :src="resolvedProfilePicture"
            class="h-full w-full object-cover"
            alt="Profile Picture"
          />
          <svg v-else class="h-14 w-14 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>

        <div class="w-full space-y-2">
          <button
            type="button"
            @click="triggerFileInput"
            class="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-750 text-gray-200 hover:text-white font-semibold rounded-xl text-xs border border-gray-750 hover:border-gray-700 transition-all flex items-center justify-center space-x-2"
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
        <p class="text-[10px] text-gray-500 leading-normal">
          Supported file formats: JPG, PNG, WEBP. Maximum file upload size: 5MB.
        </p>
      </div>

      <!-- Form (Right column) -->
      <form @submit.prevent="saveVoiceActor" class="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-xl">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <!-- First Name -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">First Name *</label>
            <input
              v-model="firstname"
              type="text"
              required
              placeholder="e.g. Richard"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- Last Name -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Name *</label>
            <input
              v-model="lastname"
              type="text"
              required
              placeholder="e.g. Darbois"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- Nationality -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nationality</label>
            <select
              v-model="nationality"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none"
            >
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

          <!-- Date of birth -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Date of Birth</label>
            <input
              v-model="dateOfBirth"
              type="date"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>


          <!-- TMDB ID -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">TMDB ID</label>
            <input
              v-model="tmdbId"
              type="number"
              placeholder="e.g. 10243"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- Wikidata ID -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Wikidata ID</label>
            <input
              v-model="wikidataId"
              type="text"
              placeholder="e.g. Q3430691"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <!-- Biography -->
        <div class="space-y-1">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Biography</label>
          <textarea
            v-model="bio"
            rows="4"
            placeholder="Type profile biography details here..."
            class="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
          ></textarea>
        </div>

        <!-- Social Media Links -->
        <div class="space-y-4">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Social Media & Links</label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Instagram</label>
              <input v-model="socialMedia.instagram" type="url" placeholder="https://instagram.com/..." class="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Twitter / X</label>
              <input v-model="socialMedia.twitter" type="url" placeholder="https://twitter.com/..." class="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">TikTok</label>
              <input v-model="socialMedia.tiktok" type="url" placeholder="https://tiktok.com/@..." class="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Facebook</label>
              <input v-model="socialMedia.facebook" type="url" placeholder="https://facebook.com/..." class="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" />
            </div>
            <div class="space-y-1 md:col-span-2">
              <label class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Website</label>
              <input v-model="socialMedia.website" type="url" placeholder="https://..." class="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs" />
            </div>
          </div>
        </div>

        <!-- Form Submit Bar -->
        <div class="flex justify-end pt-4 border-t border-gray-800/80">
          <button
            type="submit"
            :disabled="isSaving"
            class="py-3 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 text-white font-semibold rounded-xl text-sm shadow-lg transition-all duration-200 flex items-center justify-center"
          >
            <span v-if="isSaving" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
            <span>Save Profile</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Linked Works & Filmography (Bidirectional Linking) -->
    <div v-if="isEditMode" class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
      <div class="flex justify-between items-center border-b border-gray-800 pb-3">
        <div>
          <h4 class="text-base font-bold text-white">Linked Works & Filmography</h4>
          <p class="text-xs text-gray-400">All dubbing credits linked to this voice actor profile.</p>
        </div>
        <NuxtLink
          :to="localePath(`/admin/add-voice-cast/${id}`)"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1"
        >
          <span>+ Link New Work</span>
        </NuxtLink>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-gray-300">
          <thead class="bg-gray-950 text-xs font-semibold uppercase text-gray-400 border-b border-gray-800">
            <tr>
              <th class="px-4 py-3">Work ID</th>
              <th class="px-4 py-3">Media / Content ID</th>
              <th class="px-4 py-3">Type</th>
              <th class="px-4 py-3">Character</th>
              <th class="px-4 py-3">Performance</th>
              <th class="px-4 py-3 text-right">Edit Project</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800/60">
            <tr v-for="work in linkedWorks" :key="work.id" class="hover:bg-gray-950/50 transition-colors">
              <td class="px-4 py-3 font-mono text-xs text-gray-400">#{{ work.id }}</td>
              <td class="px-4 py-3 font-mono text-xs text-blue-400">Project #{{ work.dubbing_project_id }}</td>
              <td class="px-4 py-3 uppercase text-[10px] font-bold tracking-wider text-gray-400">
                <span class="px-2 py-0.5 rounded bg-gray-800 border border-gray-700">{{ work.content_type || 'movie' }}</span>
              </td>
              <td class="px-4 py-3 font-medium text-white">{{ work.suggestions || 'Character' }}</td>
              <td class="px-4 py-3 text-xs text-gray-400">{{ work.performance || 'dialogues' }}</td>
              <td class="px-4 py-3 text-right">
                <NuxtLink
                  :to="localePath(`/admin/movies/edit/${work.dubbing_project_id}`)"
                  class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 text-xs font-semibold rounded-lg border border-gray-700 transition-all inline-flex items-center space-x-1"
                >
                  <span>Edit Movie</span>
                  <span>↗</span>
                </NuxtLink>
              </td>
            </tr>
            <tr v-if="linkedWorks.length === 0">
              <td colspan="6" class="text-center py-6 text-gray-500 text-xs">
                No linked works recorded for this voice actor yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Wikipedia Works Diff -->
    <VoiceActorWorksDiff v-if="isEditMode && id && isAdmin" :voice-actor-id="id" />

    <!-- Toast Notifications -->
    <div
      v-if="toast.show"
      class="fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl text-sm max-w-sm flex items-center space-x-3"
      :class="
        toast.type === 'success'
          ? 'bg-green-950/40 border-green-900/60 text-green-200'
          : toast.type === 'error'
          ? 'bg-red-950/40 border-red-900/60 text-red-200'
          : 'bg-gray-900 border-gray-800 text-gray-200'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
  </template>

<script setup lang="ts">
const supabase = useSupabaseClient();




import { ref, onMounted, computed } from "vue";
import VoiceActorWorksDiff from "@/components/admin/VoiceActorWorksDiff.vue";


const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const voiceActorId = route.params.voiceActorId as string | undefined;
const id = voiceActorId;
const isEditMode = computed(() => !!id && id !== "new");

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === 'admin' || user.value?.user_metadata?.role === 'admin';
});

// Form inputs
const firstname = ref("");
const lastname = ref("");
const bio = ref("");
const nationality = ref("");
const dateOfBirth = ref("");
const awards = ref("");
const yearsActive = ref("");
const socialMedia = ref({
  instagram: "",
  twitter: "",
  tiktok: "",
  facebook: "",
  website: ""
});
const tmdbId = ref("");
const wikidataId = ref("");
const profilePicture = ref("");

const resolvedProfilePicture = computed(() => {
  if (!profilePicture.value) return "";
  if (profilePicture.value.startsWith("http")) return profilePicture.value;
  return supabase.storage.from("voice_actor_profile_pictures").getPublicUrl(profilePicture.value).data.publicUrl;
});

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
  formData.append("file", profilePictureFile.value, profilePictureFile.value.name);
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

const fetchLinkedWorks = async () => {};

const { data: initialData } = await useAsyncData(`voice-actor-${id}`, async () => {
  if (!isEditMode.value || !id) return null;
  const { data: va, error: vaErr } = await supabase
    .from("voice_actors")
    .select("*")
    .eq("id", id)
    .single();
    
  if (vaErr) throw vaErr;

  const { data: works, error: worksErr } = await supabase
    .from("work")
    .select("*")
    .eq("voice_actor_id", id);

  return {
    voiceActor: va,
    linkedWorks: works || []
  };
});

watch(initialData, (data) => {
  if (data) {
    if (data.voiceActor) {
      firstname.value = data.voiceActor.firstname;
      lastname.value = data.voiceActor.lastname;
      bio.value = data.voiceActor.bio || "";
      nationality.value = data.voiceActor.nationality || "";
      dateOfBirth.value = data.voiceActor.date_of_birth || "";
      awards.value = data.voiceActor.awards || "";
      yearsActive.value = data.voiceActor.years_active || "";
      
      const links = data.voiceActor.social_media_links || {};
      socialMedia.value = {
        instagram: links.instagram || "",
        twitter: links.twitter || "",
        tiktok: links.tiktok || "",
        facebook: links.facebook || "",
        website: links.website || ""
      };
      
      tmdbId.value = data.voiceActor.tmdb_id || "";
      profilePicture.value = data.voiceActor.profile_picture || "";
      wikidataId.value = data.voiceActor.wikidata_id || "";
    }
    linkedWorks.value = data.linkedWorks;
  }
}, { immediate: true });

const fetchVoiceActor = async () => {}; // Dummy

const saveVoiceActor = async () => {
  isSaving.value = true;
  const links: Record<string, string> = {};
  if (socialMedia.value.instagram) links.instagram = socialMedia.value.instagram;
  if (socialMedia.value.twitter) links.twitter = socialMedia.value.twitter;
  if (socialMedia.value.tiktok) links.tiktok = socialMedia.value.tiktok;
  if (socialMedia.value.facebook) links.facebook = socialMedia.value.facebook;
  if (socialMedia.value.website) links.website = socialMedia.value.website;

  const upsertData: any = {
    firstname: firstname.value,
    lastname: lastname.value,
    bio: bio.value || null,
    nationality: nationality.value || null,
    date_of_birth: dateOfBirth.value || null,
    awards: awards.value || null,
    years_active: yearsActive.value || null,
    social_media_links: Object.keys(links).length > 0 ? links : null,
    profile_picture: profilePicture.value || null,
    tmdb_id: tmdbId.value ? Number(tmdbId.value) : null,
    wikidata_id: wikidataId.value || null,
  };

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
  } catch (err: any) {
    console.error("Error saving voice actor profile:", err);
    showToast(err.message || "Failed to save voice actor.", "error");
  } finally {
    isSaving.value = false;
  }
};


</script>
