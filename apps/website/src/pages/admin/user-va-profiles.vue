<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <!-- Intro Card -->
    <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800">
      <h3 class="text-lg font-bold text-white">Link User to Voice Actor Profile</h3>
      <p class="text-sm text-slate-400 mt-1">Associate a user login account to their public voice actor profile. This allows them to manage their own voice cast records.</p>
    </div>

    <!-- Form Panel -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
      <!-- User Autocomplete -->
      <div class="space-y-2 relative">
        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block">1. Select User Account</label>
        <div class="flex items-center space-x-2">
          <div class="relative flex-1">
            <input
              type="text"
              v-model="userQuery"
              placeholder="Search user email..."
              @focus="isUserDropdownOpen = true"
              @input="handleUserInput"
              class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <span class="absolute right-3.5 top-3.5 text-slate-500">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
          <!-- Clear Button -->
          <button
            v-if="selectedUser"
            @click="clearUserSelection"
            class="p-3 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-xl hover:bg-slate-850 transition-colors"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- User Dropdown Panel -->
        <div
          v-if="isUserDropdownOpen && filteredUsers.length > 0"
          class="absolute z-40 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-800/60"
        >
          <div
            v-for="u in filteredUsers"
            :key="u.id"
            @click="selectUser(u)"
            class="px-4 py-3 hover:bg-slate-800/40 cursor-pointer flex flex-col transition-colors"
          >
            <span class="text-sm font-semibold text-white">{{ u.email }}</span>
            <span class="text-xs text-slate-500 font-mono mt-0.5">{{ u.id }}</span>
          </div>
        </div>
        <!-- Loader / Empty feedback in dropdown -->
        <div
          v-else-if="isUserDropdownOpen && userQuery.trim() && userLoading"
          class="absolute z-40 left-0 right-0 mt-1.5 p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400 text-xs"
        >
          Loading users list...
        </div>
        <div
          v-else-if="isUserDropdownOpen && userQuery.trim() && filteredUsers.length === 0"
          class="absolute z-40 left-0 right-0 mt-1.5 p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-500 text-xs"
        >
          No matching user account found.
        </div>
      </div>

      <!-- Voice Actor Autocomplete -->
      <div class="space-y-2 relative">
        <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block">2. Select Voice Actor Profile</label>
        <div class="flex items-center space-x-2">
          <div class="relative flex-1">
            <input
              type="text"
              v-model="voiceActorQuery"
              placeholder="Search voice actor name..."
              @focus="isVoiceActorDropdownOpen = true"
              @input="handleVoiceActorInput"
              class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <span class="absolute right-3.5 top-3.5 text-slate-500">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
          <!-- Clear Button -->
          <button
            v-if="selectedVoiceActor"
            @click="clearVoiceActorSelection"
            class="p-3 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-xl hover:bg-slate-850 transition-colors"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Voice Actor Dropdown Panel -->
        <div
          v-if="isVoiceActorDropdownOpen && voiceActorResults.length > 0"
          class="absolute z-40 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-800/60"
        >
          <div
            v-for="va in voiceActorResults"
            :key="va.id"
            @click="selectVoiceActor(va)"
            class="px-4 py-3 hover:bg-slate-800/40 cursor-pointer flex items-center space-x-3 transition-colors"
          >
            <div class="h-8 w-8 rounded-full overflow-hidden border border-slate-800 bg-slate-950 shrink-0 flex items-center justify-center text-slate-500">
              <NuxtImg format="webp" v-if="va.profile_picture" :src="getProfilePictureUrl(va.profile_picture) || undefined" class="h-full w-full object-cover" />
              <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span class="text-sm font-semibold text-white">{{ va.firstname }} {{ va.lastname }}</span>
          </div>
        </div>
        <!-- Loader / Empty feedback in dropdown -->
        <div
          v-else-if="isVoiceActorDropdownOpen && voiceActorQuery.trim() && voiceActorSearching"
          class="absolute z-40 left-0 right-0 mt-1.5 p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400 text-xs"
        >
          Searching voice actors...
        </div>
        <div
          v-else-if="isVoiceActorDropdownOpen && voiceActorQuery.trim() && voiceActorResults.length === 0"
          class="absolute z-40 left-0 right-0 mt-1.5 p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-500 text-xs"
        >
          No voice actors found matching query.
        </div>
      </div>

      <!-- Selected State cards -->
      <div v-if="selectedUser || selectedVoiceActor" class="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-2.5">
        <div v-if="selectedUser" class="flex justify-between items-center text-xs">
          <span class="text-slate-500 font-bold uppercase tracking-wider">Target User</span>
          <span class="font-semibold text-blue-400 font-mono">{{ selectedUser.email }}</span>
        </div>
        <div v-if="selectedVoiceActor" class="flex justify-between items-center text-xs">
          <span class="text-slate-500 font-bold uppercase tracking-wider">Voice Actor Profile</span>
          <span class="font-semibold text-indigo-400 font-mono">{{ selectedVoiceActor.firstname }} {{ selectedVoiceActor.lastname }}</span>
        </div>
      </div>

      <!-- Action Button -->
      <button
        @click="linkUserVoiceActor"
        :disabled="!selectedUser || !selectedVoiceActor || linking"
        class="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex justify-center items-center text-sm"
      >
        <span v-if="linking" class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
        <span>Link Profile Account</span>
      </button>
    </div>

    <!-- Existing Links Panel -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl mt-8">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-white">Existing Links</h3>
        <button
          @click="fetchExistingLinks"
          class="p-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-xl hover:bg-slate-850 transition-colors"
          title="Refresh List"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      <div v-if="linksLoading" class="text-slate-400 text-sm py-4 text-center">Loading links...</div>
      <div v-else-if="existingLinks.length === 0" class="text-slate-500 text-sm py-4 text-center">No profiles linked yet.</div>
      <div v-else class="space-y-3">
        <div v-for="link in existingLinks" :key="link.id" class="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-850 rounded-xl">
          <div class="flex flex-col gap-1">
            <span class="text-sm font-bold text-white">{{ link.userEmail }}</span>
            <span class="text-xs text-slate-500 font-mono">{{ link.user_id }}</span>
          </div>
          <svg class="h-4 w-4 text-slate-600 mx-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <div class="flex items-center space-x-3 text-right">
            <span class="text-sm font-bold text-indigo-400">{{ link.voiceActorName }}</span>
            <div class="h-8 w-8 rounded-full overflow-hidden border border-slate-800 bg-slate-950 shrink-0 flex items-center justify-center text-slate-500">
              <NuxtImg format="webp" v-if="link.voiceActorImage" :src="getProfilePictureUrl(link.voiceActorImage) || undefined" class="h-full w-full object-cover" />
              <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>
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




definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

import { ref, computed, onMounted } from "vue";
const supabase = useSupabaseClient();

const getProfilePictureUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const { data } = supabase.storage
    .from("voice_actor_profile_pictures")
    .getPublicUrl(path);
  return data.publicUrl;
};

interface User {
  id: string;
  email: string;
}

interface VoiceActor {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture: string | null;
}

// Selections
const selectedUser = ref<User | null>(null);
const selectedVoiceActor = ref<VoiceActor | null>(null);

// Search Query Inputs
const userQuery = ref("");
const voiceActorQuery = ref("");

// Dropdowns visibility
const isUserDropdownOpen = ref(false);
const isVoiceActorDropdownOpen = ref(false);

// Query States
const allUsers = ref<User[]>([]);
const userLoading = ref(false);
const usersFetched = ref(false);

const voiceActorResults = ref<VoiceActor[]>([]);
const voiceActorSearching = ref(false);
const linking = ref(false);

const existingLinks = ref<any[]>([]);
const linksLoading = ref(false);

// Debouncing helpers
let vaSearchTimer: ReturnType<typeof setTimeout> | null = null;

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

// Fetch all users list once
const fetchUsersList = async () => {
  if (usersFetched.value) return;
  userLoading.value = true;

  try {
    const { data, error } = await supabase.functions.invoke("list_users", { method: 'GET' });

    if (error) throw error;
    allUsers.value = data?.users || [];
    usersFetched.value = true;
    fetchExistingLinks();
  } catch (err: any) {
    console.error("Error fetching users list:", err);
    showToast("Error loading users database", "error");
  } finally {
    userLoading.value = false;
  }
};

const handleUserInput = () => {
  isUserDropdownOpen.value = true;
  if (!usersFetched.value) {
    fetchUsersList();
  }
};

// Filter users list based on input
const filteredUsers = computed(() => {
  if (!userQuery.value.trim()) return allUsers.value;
  const q = userQuery.value.toLowerCase().trim();
  return allUsers.value.filter(u => u.email?.toLowerCase().includes(q));
});

const selectUser = (u: User) => {
  selectedUser.value = u;
  userQuery.value = u.email;
  isUserDropdownOpen.value = false;
};

const clearUserSelection = () => {
  selectedUser.value = null;
  userQuery.value = "";
  isUserDropdownOpen.value = false;
};

const handleVoiceActorInput = () => {
  isVoiceActorDropdownOpen.value = true;
  if (vaSearchTimer) clearTimeout(vaSearchTimer);
  vaSearchTimer = setTimeout(() => {
    searchVoiceActors();
  }, 300);
};

const searchVoiceActors = async () => {
  const query = voiceActorQuery.value.trim();
  if (!query) {
    voiceActorResults.value = [];
    return;
  }

  voiceActorSearching.value = true;
  try {
    const { data, error } = await supabase.functions.invoke("search-voice-actors", {
      body: { query, limit: 10 }
    });

    if (error) throw error;
    voiceActorResults.value = data || [];
  } catch (err: any) {
    console.error("Error searching voice actors:", err);
    showToast("Failed to search voice actors", "error");
  } finally {
    voiceActorSearching.value = false;
  }
};

const selectVoiceActor = (va: VoiceActor) => {
  selectedVoiceActor.value = va;
  voiceActorQuery.value = `${va.firstname} ${va.lastname}`;
  isVoiceActorDropdownOpen.value = false;
};

const clearVoiceActorSelection = () => {
  selectedVoiceActor.value = null;
  voiceActorQuery.value = "";
  voiceActorResults.value = [];
  isVoiceActorDropdownOpen.value = false;
};

const linkUserVoiceActor = async () => {
  if (!selectedUser.value || !selectedVoiceActor.value) return;

  linking.value = true;
  try {
    const { error } = await supabase.functions.invoke("link-user-voice-actor", {
      body: {
        user_id: selectedUser.value.id,
        voice_actor_id: selectedVoiceActor.value.id
      }
    });

    if (error) throw error;
    showToast("User account successfully linked to voice actor profile", "success");

    // Reset inputs
    clearUserSelection();
    clearVoiceActorSelection();
    fetchExistingLinks();
  } catch (err: any) {
    console.error("Error linking user to voice actor:", err);
    showToast(err.message || "Failed to link profile", "error");
  } finally {
    linking.value = false;
  }
};

// Global click handler to close dropdowns
const setupClickListeners = () => {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".relative")) {
      isUserDropdownOpen.value = false;
      isVoiceActorDropdownOpen.value = false;
    }
  });
};

const fetchExistingLinks = async () => {
  linksLoading.value = true;
  try {
    const { data, error } = await supabase
      .from("user_voice_actor_links")
      .select('id, user_id, voice_actors(id, firstname, lastname, profile_picture)')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    existingLinks.value = data.map((link: any) => ({
      id: link.id,
      user_id: link.user_id,
      userEmail: allUsers.value.find(u => u.id === link.user_id)?.email || 'Unknown User',
      voiceActorName: link.voice_actors ? `${link.voice_actors.firstname} ${link.voice_actors.lastname}` : 'Unknown Actor',
      voiceActorImage: link.voice_actors?.profile_picture || null
    }));
  } catch (err: any) {
    console.error("Error fetching links:", err);
  } finally {
    linksLoading.value = false;
  }
};

onMounted(() => {
  fetchUsersList();
  setupClickListeners();
});
</script>
