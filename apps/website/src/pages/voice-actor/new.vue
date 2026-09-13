<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Header -->
    <div
      class="theme-surface-overlay p-6 rounded-2xl border theme-border flex justify-between items-center"
    >
      <div>
        <h3 class="text-lg font-bold theme-text">
          {{
            isEditMode
              ? $t("voiceActorEdit.titleEdit")
              : $t("voiceActorEdit.titleCreate")
          }}
        </h3>
        <p class="text-sm theme-text-muted mt-0.5">
          {{
            isEditMode
              ? `Updating database entry ID #${id}`
              : $t("voiceActorEdit.fillInfo")
          }}
        </p>
      </div>
      <NuxtLink
        :to="localePath('/admin/voice-actor-spreadsheet')"
        class="text-xs font-semibold px-4 py-2.5 theme-surface-muted theme-hover-surface-muted theme-text-secondary theme-hover-text rounded-xl border theme-border transition-colors"
        >{{ $t("voiceActorEdit.backToSpreadsheet") }}</NuxtLink
      >
    </div>

    <!-- Main Workspace -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Profile Image Card (Left column) -->
      <div
        class="theme-surface-overlay border theme-border rounded-2xl p-6 flex flex-col items-center text-center space-y-5 h-fit shadow-xl"
      >
        <label
          class="text-xs font-bold theme-text-muted uppercase tracking-wider block self-start"
          >{{ $t("voiceActorEdit.profilePhoto") }}</label
        >
        <div
          class="relative h-44 w-44 rounded-full overflow-hidden border-2 theme-border theme-input flex items-center justify-center theme-text-muted shadow-inner group"
        >
          <NuxtImg
            format="webp"
            v-if="profilePicture"
            :src="profilePicture"
            class="h-full w-full object-cover"
            alt="Profile Picture"
          />
          <svg
            v-else
            class="h-14 w-14 theme-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>

        <div class="w-full space-y-2">
          <button
            type="button"
            @click="triggerFileInput"
            class="w-full py-2.5 px-4 theme-surface-muted theme-hover-surface-muted theme-text theme-hover-text font-semibold rounded-xl text-xs border theme-border theme-hover-border transition-all flex items-center justify-center space-x-2"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>{{
              previewImage
                ? $t("voiceActorEdit.changeImage")
                : $t("voiceActorEdit.uploadImage")
            }}</span>
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
            class="w-full py-2 theme-status-danger theme-hover-surface-muted rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all"
          >
            {{ $t("voiceActorEdit.resetImageSelection") }}
          </button>
        </div>
        <p class="text-[10px] theme-text-muted leading-normal">
          {{ $t("voiceActorEdit.supportedFileFormats") }}
        </p>
      </div>

      <!-- Form (Right column) -->
      <form
        @submit.prevent="saveVoiceActor"
        class="lg:col-span-2 theme-surface-overlay border theme-border rounded-2xl p-6 space-y-6 shadow-xl"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <!-- First Name -->
          <div class="space-y-1">
            <label
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("admin.movieEditor.firstName") }}</label
            >
            <input
              v-model="firstname"
              type="text"
              required
              placeholder="e.g. Richard"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-sm"
            />
          </div>

          <!-- Last Name -->
          <div class="space-y-1">
            <label
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("admin.movieEditor.lastName") }}</label
            >
            <input
              v-model="lastname"
              type="text"
              required
              placeholder="e.g. Darbois"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-sm"
            />
          </div>

          <!-- Nationality -->
          <div class="space-y-1">
            <label
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("profile.nationality") }}</label
            >
            <input
              v-model="nationality"
              type="text"
              placeholder="e.g. Français"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-sm"
            />
          </div>

          <!-- Date of birth -->
          <div class="space-y-1">
            <label
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("voiceActorEdit.dateOfBirth") }}</label
            >
            <input
              v-model="dateOfBirth"
              type="date"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-focus text-sm"
            />
          </div>

          <!-- TMDB ID -->
          <div class="space-y-1">
            <label
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("voiceActorEdit.tmdbId") }}</label
            >
            <input
              v-model="tmdbId"
              type="number"
              placeholder="e.g. 10243"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-sm"
            />
          </div>

          <!-- Wikidata ID -->
          <div class="space-y-1">
            <label
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("voiceActorEdit.wikidataId") }}</label
            >
            <input
              v-model="wikidataId"
              type="text"
              placeholder="e.g. Q3430691"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-sm"
            />
          </div>
        </div>

        <!-- Biography -->
        <div class="space-y-1">
          <label
            class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
            >{{ $t("profile.biography") }}</label
          >
          <textarea
            v-model="bio"
            rows="4"
            placeholder="Type profile biography details here..."
            class="w-full px-4 py-3 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-sm resize-y"
          ></textarea>
        </div>

        <!-- Social Media Links -->
        <div class="space-y-1">
          <div class="flex justify-between items-center">
            <label
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("voiceActorEdit.socialMediaLinksJson") }}</label
            >
            <span class="text-[10px] theme-text-muted"
              >e.g. {"facebook": "https://...", "twitter": "..."}</span
            >
          </div>
          <textarea
            v-model="socialMediaLinks"
            rows="3"
            placeholder='{ "instagram": "https://..." }'
            class="w-full px-4 py-3 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-xs font-mono resize-y"
          ></textarea>
        </div>

        <!-- Form Submit Bar -->
        <div class="flex justify-end pt-4 border-t theme-border">
          <button
            type="submit"
            :disabled="isSaving"
            class="py-3 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-[var(--app-color-surface-muted)] disabled:to-[var(--app-color-surface-muted)] disabled:text-[var(--app-color-text-muted)] text-white font-semibold rounded-xl text-sm shadow-lg transition-all duration-200 flex items-center justify-center"
          >
            <span
              v-if="isSaving"
              class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
            ></span>
            <span>{{ $t("voiceActorEdit.saveProfile") }}</span>
          </button>
        </div>
      </form>
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
            : 'theme-surface-overlay theme-border theme-text'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient();

import { ref, onMounted, computed } from "vue";

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const voiceActorId = undefined;
const id = voiceActorId;
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
  type: "info",
});

const showToast = (
  message: string,
  type: "success" | "error" | "info" = "info",
) => {
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
  if (files && files.length > 0 && files[0]) {
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

  const result = await $fetch<{ ok: boolean }>("/api/upload-profile-picture", {
    method: "POST",
    body: formData,
  });

  if (result && result.ok) {
    return profilePictureFile.value.name;
  }
  return profilePicture.value;
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

    let voiceActorId: any = id;
    if (!isEditMode.value && data && data.length > 0 && data[0]) {
      voiceActorId = String(data[0].id);
    }

    // Upload profile picture if chosen
    if (profilePictureFile.value && voiceActorId) {
      await uploadProfilePicture(voiceActorId);
    }

    showToast("Voice actor profile saved successfully!", "success");

    // Redirect to spreadsheet after 1.5s
    setTimeout(() => {
      router.push(localePath("/admin/voice-actor-spreadsheet"));
    }, 1500);
  } catch (err: any) {
    console.error("Error saving voice actor profile:", err);
    showToast(err.message || "Failed to save voice actor.", "error");
  } finally {
    isSaving.value = false;
  }
};
</script>
