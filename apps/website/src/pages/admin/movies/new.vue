<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex justify-between items-center shadow-xl">
      <div>
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <svg class="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h18M3 16h18" />
          </svg>
          {{ isEditMode ? 'Edit Movie & Technical Team' : 'Create Movie & Dubbing Project' }}
        </h3>
        <p class="text-sm text-gray-400 mt-1">
          {{ isEditMode ? `Updating dubbing project ID #${id}` : 'Fill in media information, technical crew, and voice actor credits.' }}
        </p>
      </div>
      <NuxtLink
        :to="localePath('/admin')"
        class="text-xs font-semibold px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl border border-gray-700 transition-colors flex items-center space-x-2"
      >
        <span>← Back to Dashboard</span>
      </NuxtLink>
    </div>

    <!-- Main Workspace -->
    <form @submit.prevent="saveMovieProject" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Media Metadata Card (Left Column) -->
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5 h-fit shadow-xl">
          <h4 class="text-sm font-bold text-gray-200 uppercase tracking-wider border-b border-gray-800 pb-3 flex items-center justify-between">
            <span>Media Info</span>
            <span class="text-xs text-blue-400 font-normal">TMDB Linked</span>
          </h4>

          <!-- Poster Preview -->
          <div class="flex justify-center">
            <div class="relative h-48 w-32 rounded-xl overflow-hidden border border-gray-800 bg-gray-950 flex items-center justify-center text-gray-500 shadow-md">
              <NuxtImg format="webp"                 v-if="posterUrl"
                :src="posterUrl"
                class="h-full w-full object-cover"
                alt="Poster"
              />
              <div v-else class="text-center p-3 text-gray-600">
                <svg class="h-10 w-10 mx-auto mb-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span class="text-[10px]">No poster image</span>
              </div>
            </div>
          </div>

          <!-- Content ID / TMDB ID -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">TMDB / Content ID *</label>
            <div class="flex space-x-2">
              <input
                v-model.number="contentId"
                type="number"
                required
                placeholder="e.g. 550"
                class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                type="button"
                @click="fetchTmdbMetadata"
                :disabled="isFetchingTmdb || !contentId"
                class="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 whitespace-nowrap"
              >
                {{ isFetchingTmdb ? '...' : 'Fetch' }}
              </button>
            </div>
          </div>

          <!-- Content Type -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Content Type</label>
            <select
              v-model="contentType"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="movie">Movie</option>
              <option value="tv">TV / Series</option>
            </select>
          </div>

          <!-- Media Name / Title -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Media Title *</label>
            <input
              v-model="mediaTitle"
              type="text"
              required
              placeholder="e.g. Fight Club"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- Language -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dubbing Language</label>
            <input
              v-model="language"
              type="text"
              placeholder="fr"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <!-- Status -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</label>
            <select
              v-model="status"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="validated">Validated</option>
              <option value="pending">Pending Review</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        <!-- Technical Crew Form (Right 2 Columns) -->
        <div class="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <h4 class="text-sm font-bold text-gray-200 uppercase tracking-wider border-b border-gray-800 pb-3 flex items-center justify-between">
            <span>Technical Dubbing Team</span>
            <span class="text-xs text-gray-400">Crew Attributes</span>
          </h4>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Studio -->
            <div class="space-y-1">
              <div class="flex justify-between items-center">
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dubbing Studio</label>
                <NuxtLink :to="localePath('/admin/studios/new')" target="_blank" class="text-[10px] text-blue-400 hover:underline">+ New Studio</NuxtLink>
              </div>
              <div class="flex space-x-2">
                <select
                  v-model="selectedStudioId"
                  @change="onStudioSelectChange"
                  class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option :value="null">-- Select Studio --</option>
                  <option v-for="s in studiosList" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
                <NuxtLink
                  v-if="selectedStudioId"
                  :to="$localePath(`/studios/edit/${selectedStudioId}`)"
                  target="_blank"
                  class="px-3 py-2.5 bg-gray-800 text-blue-400 hover:text-blue-300 text-xs font-semibold rounded-xl border border-gray-700"
                >
                  ↗
                </NuxtLink>
              </div>
            </div>

            <!-- Artistic Director -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Artistic Director (D.A.)</label>
              <input
                v-model="artisticDirector"
                type="text"
                placeholder="e.g. Jean-Philippe Puymartin"
                class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <!-- Adaptation -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Adaptation / Dialogueur</label>
              <input
                v-model="adaptation"
                type="text"
                placeholder="e.g. Marie-Christine Chevalier"
                class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <!-- Recording -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sound Recording (Enregistrement)</label>
              <input
                v-model="recording"
                type="text"
                placeholder="e.g. Studio A"
                class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <!-- Editing -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sound Editing (Montage)</label>
              <input
                v-model="editing"
                type="text"
                placeholder="e.g. Pierre Dupont"
                class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <!-- Mixing -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sound Mixing (Mixage)</label>
              <input
                v-model="mixing"
                type="text"
                placeholder="e.g. Marc Durand"
                class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <!-- Project Manager -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project Manager</label>
              <input
                v-model="projectManager"
                type="text"
                placeholder="e.g. Sophie Martin"
                class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <!-- Creative Supervision -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Creative Supervision</label>
              <input
                v-model="creativeSupervision"
                type="text"
                placeholder="e.g. Disney Character Voices International"
                class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Voice Acting Cast Table -->
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div class="flex justify-between items-center border-b border-gray-800 pb-3">
          <div>
            <h4 class="text-base font-bold text-white">Dubbing Cast & Voice Actors</h4>
            <p class="text-xs text-gray-400">Map original actors to french voice actors and character names.</p>
          </div>
          <div class="flex items-center space-x-2">
            <button
              type="button"
              @click="openCreatePersonModal"
              class="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 font-semibold rounded-xl text-xs border border-gray-700 transition-all flex items-center space-x-1"
            >
              <span>+ New Voice Actor</span>
            </button>
            <button
              type="button"
              @click="addCastRow"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1"
            >
              <span>+ Add Cast Member</span>
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-gray-300">
            <thead class="bg-gray-950 text-xs font-semibold uppercase text-gray-400 border-b border-gray-800">
              <tr>
                <th class="px-4 py-3">Actor ID</th>
                <th class="px-4 py-3">Original Character Name</th>
                <th class="px-4 py-3">French Voice Actor</th>
                <th class="px-4 py-3">Performance</th>
                <th class="px-4 py-3 text-center">Highlight</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800/60">
              <tr v-for="(row, index) in castRows" :key="index" class="hover:bg-gray-950/50 transition-colors">
                <!-- Actor ID -->
                <td class="px-4 py-3 w-28">
                  <input
                    v-model.number="row.actor_id"
                    type="number"
                    required
                    placeholder="Actor ID"
                    class="w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-white text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </td>

                <!-- Character Name -->
                <td class="px-4 py-3">
                  <input
                    v-model="row.character_name"
                    type="text"
                    placeholder="e.g. Woody"
                    class="w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-white text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </td>

                <!-- Voice Actor Select -->
                <td class="px-4 py-3">
                  <div class="flex items-center space-x-2">
                    <select
                      v-model="row.voice_actor_id"
                      class="w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-white text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option :value="null">-- Unassigned --</option>
                      <option
                        v-for="va in voiceActorsList"
                        :key="va.id"
                        :value="va.id"
                      >
                        {{ va.firstname }} {{ va.lastname }}
                      </option>
                    </select>
                    <NuxtLink
                      v-if="row.voice_actor_id"
                      :to="$localePath(`/voice-actors/edit/${row.voice_actor_id}`)"
                      target="_blank"
                      title="Edit Voice Actor Profile"
                      class="text-blue-400 hover:text-blue-300 text-xs px-1.5 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700"
                    >
                      ↗
                    </NuxtLink>
                  </div>
                </td>

                <!-- Performance -->
                <td class="px-4 py-3 w-36">
                  <select
                    v-model="row.performance"
                    class="w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-white text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="dialogues">Dialogues</option>
                    <option value="chant">Chant</option>
                    <option value="dialogues & chant">Dialogues & Chant</option>
                    <option value="ambiances">Ambiances</option>
                  </select>
                </td>

                <!-- Highlight -->
                <td class="px-4 py-3 text-center w-20">
                  <input
                    v-model="row.highlight"
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-800 bg-gray-950 text-blue-600 focus:ring-blue-500"
                  />
                </td>

                <!-- Remove Row -->
                <td class="px-4 py-3 text-right w-20">
                  <button
                    type="button"
                    @click="removeCastRow(index)"
                    class="text-red-400 hover:text-red-300 p-1 hover:bg-red-950/30 rounded transition-colors"
                  >
                    ✕
                  </button>
                </td>
              </tr>
              <tr v-if="castRows.length === 0">
                <td colspan="6" class="text-center py-6 text-gray-500 text-xs">
                  No cast members added yet. Click "+ Add Cast Member" to begin mapping voice actors.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Save Bar -->
      <div class="flex justify-end pt-4 border-t border-gray-800/80">
        <button
          type="submit"
          :disabled="isSaving"
          class="py-3.5 px-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm shadow-xl transition-all flex items-center justify-center space-x-2"
        >
          <span v-if="isSaving" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
          <span>Save Movie & Technical Team</span>
        </button>
      </div>
    </form>

    <!-- Modal for Quick-Creating Voice Actor -->
    <div v-if="showCreatePersonModal" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4">
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
        <div class="flex justify-between items-center border-b border-gray-800 pb-3">
          <h3 class="text-base font-bold text-white">Create New Voice Actor Profile</h3>
          <button @click="showCreatePersonModal = false" class="text-gray-400 hover:text-white text-lg">✕</button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-xs font-semibold text-gray-400 uppercase">First Name *</label>
            <input
              v-model="newPersonFirstname"
              type="text"
              required
              placeholder="e.g. Richard"
              class="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-400 uppercase">Last Name *</label>
            <input
              v-model="newPersonLastname"
              type="text"
              required
              placeholder="e.g. Darbois"
              class="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-400 uppercase">Nationality</label>
            <input
              v-model="newPersonNationality"
              type="text"
              placeholder="Français"
              class="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="flex justify-end space-x-3 pt-3 border-t border-gray-800">
          <button
            type="button"
            @click="showCreatePersonModal = false"
            class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="quickCreateVoiceActor"
            :disabled="isCreatingPerson || !newPersonFirstname || !newPersonLastname"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
          >
            {{ isCreatingPerson ? 'Creating...' : 'Create & Assign' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Attachments Section (Only in Edit Mode) -->
    <div v-if="isEditMode" class="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden mt-8">
      <div class="px-6 py-4 border-b border-gray-800 bg-gray-950/50 flex justify-between items-center">
        <div>
          <h2 class="text-lg font-bold text-white tracking-tight">Project Attachments (Proofs)</h2>
          <p class="text-xs text-gray-400 mt-1">Upload ending credits or other images to prove the voice cast.</p>
        </div>
      </div>

      <div class="p-6">
        <!-- Upload Form -->
        <div class="flex flex-col md:flex-row gap-4 items-end mb-6 bg-gray-950/50 p-4 rounded-xl border border-gray-800/60">
          <div class="flex-1 w-full">
            <label class="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">Description</label>
            <input
              v-model="newAttachmentDescription"
              type="text"
              placeholder="e.g. End credits showing French cast"
              class="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="flex-1 w-full">
            <label class="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">Image File</label>
            <input
              type="file"
              accept="image/*"
              @change="handleFileUpload"
              :disabled="isUploadingAttachment"
              class="w-full px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-xl text-gray-300 text-sm focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
            />
          </div>
          <div v-if="isUploadingAttachment" class="flex items-center justify-center px-4 py-2 text-blue-400 text-xs font-semibold">
            Uploading...
          </div>
        </div>

        <!-- Attachments List -->
        <div v-if="attachments.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="att in attachments" :key="att.id" class="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow flex flex-col">
            <div class="aspect-video bg-gray-900 relative group overflow-hidden">
              <NuxtImg format="webp" v-if="att.signedUrl" :src="att.signedUrl" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-gray-500 text-xs">Loading...</div>
              <div class="absolute inset-0 bg-gray-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4 backdrop-blur-sm">
                <a v-if="att.signedUrl" :href="att.signedUrl" target="_blank" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-500 transition-colors shadow">View Full</a>
                <button @click="deleteAttachment(att.id, att.file_path)" class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-500 transition-colors shadow">Delete</button>
              </div>
            </div>
            <div class="p-3">
              <p class="text-sm text-gray-200 font-medium truncate">{{ att.description || 'No description' }}</p>
              <p class="text-xs text-gray-500 mt-1 truncate">{{ att.file_name }}</p>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-gray-800 rounded-xl">
          No attachments uploaded yet.
        </div>
      </div>
    </div>

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
const supabase = useSupabaseClient();




definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

import { ref, onMounted, computed } from "vue";

import imageCompression from "browser-image-compression";

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const id = route.params.id as string | undefined;
const isEditMode = computed(() => !!id && id !== "new");

// Form state - Media info
const contentId = ref<number | null>(null);
const mediaTitle = ref("");
const contentType = ref("movie");
const language = ref("fr");
const posterUrl = ref("");
const status = ref("validated");

// Form state - Technical Team
const studio = ref("");
const selectedStudioId = ref<number | null>(null);
const studiosList = ref<Array<{ id: number; name: string }>>([]);
const artisticDirector = ref("");
const adaptation = ref("");
const recording = ref("");

const fetchStudios = async () => {
  try {
    const { data } = await supabase.from("studios").select("id, name").order("name", { ascending: true });
    studiosList.value = data || [];
  } catch (e) {
    console.error("Error fetching studios list:", e);
  }
};

const onStudioSelectChange = () => {
  const found = studiosList.value.find(s => s.id === selectedStudioId.value);
  if (found) {
    studio.value = found.name;
  } else {
    studio.value = "";
  }
};
const editing = ref("");
const mixing = ref("");
const projectManager = ref("");
const creativeSupervision = ref("");

// Voice actors list for dropdowns
const voiceActorsList = ref<Array<{ id: number; firstname: string; lastname: string }>>([]);

// Cast rows
interface CastRow {
  id?: number;
  actor_id: number;
  character_name: string;
  voice_actor_id: number | null;
  performance: string;
  highlight: boolean;
}
const castRows = ref<CastRow[]>([]);

// Attachments state
interface ProjectAttachment {
  id: number;
  dubbing_project_id: number;
  file_path: string;
  file_name: string;
  description: string | null;
  created_at: string | null;
  signedUrl?: string; // Cache the signed url
}
const attachments = ref<ProjectAttachment[]>([]);
const isUploadingAttachment = ref(false);
const newAttachmentDescription = ref("");

// Loading & UI states
const isSaving = ref(false);
const isFetchingTmdb = ref(false);
const showCreatePersonModal = ref(false);
const isCreatingPerson = ref(false);

// Quick person creation form
const newPersonFirstname = ref("");
const newPersonLastname = ref("");
const newPersonNationality = ref("Français");

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

const fetchVoiceActors = async () => {
  try {
    const { data, error } = await supabase
      .from("voice_actors")
      .select("id, firstname, lastname")
      .order("lastname", { ascending: true });

    if (error) throw error;
    voiceActorsList.value = data || [];
  } catch (err: any) {
    console.error("Error fetching voice actors:", err);
  }
};

const fetchMovieProject = async () => {
  if (!isEditMode.value || !id) return;

  try {
    // Fetch dubbing project details
    const { data: project, error: projErr } = await supabase
      .from("dubbing_projects")
      .select("*")
      .eq("id", id)
      .single();

    if (projErr) throw projErr;

    if (project) {
      contentId.value = project.content_id;
      contentType.value = project.content_type || "movie";
      language.value = project.language || "fr-FR";
      studio.value = project.studio || "";
      selectedStudioId.value = project.studio_id || (studiosList.value.find(s => s.name === project.studio)?.id || null);
      artisticDirector.value = project.artistic_director || "";
      adaptation.value = project.adaptation || "";
      recording.value = project.recording || "";
      editing.value = project.editing || "";
      mixing.value = project.mixing || "";
      projectManager.value = project.project_manager || "";
      creativeSupervision.value = project.creative_supervision || "";
      status.value = project.status || "validated";

      // Fetch attachments
      const { data: attachData, error: attachErr } = await supabase
        .from("project_attachments")
        .select("*")
        .eq("dubbing_project_id", project.id)
        .order("created_at", { ascending: false });

      if (attachErr) {
        console.error("Error fetching attachments:", attachErr);
      } else {
        attachments.value = attachData || [];
        await fetchSignedUrlsForAttachments(attachments.value);
      }

      // Fetch linked work entries for this project
      const { data: works, error: worksErr } = await supabase
        .from("work")
        .select("*")
        .eq("dubbing_project_id", project.id);

      if (worksErr) throw worksErr;

      if (works) {
        castRows.value = works.map((w: any) => ({
          id: w.id,
          actor_id: w.actor_id,
          character_name: w.suggestions || "",
          voice_actor_id: w.voice_actor_id,
          performance: w.performance || "dialogues",
          highlight: w.highlight || false
        }));
      }
      if (project.content_id) {
        fetchTmdbMetadata();
      }
    }
  } catch (err: any) {
    console.error("Error loading movie project:", err);
    showToast("Failed to load movie project details", "error");
  }
};

const fetchTmdbMetadata = async () => {
  if (!contentId.value) return;
  isFetchingTmdb.value = true;
  try {
    const isShow = contentType.value === "tv" || contentType.value === "show" || contentType.value === "serie";
    const functionName = isShow ? "show" : "movie";

    const { data } = await supabase.functions.invoke(functionName, {
      body: { id: contentId.value }
    });

    if (data) {
      const mediaObj = isShow ? data.serie : data.movie;
      if (mediaObj?.name || mediaObj?.title) {
        mediaTitle.value = mediaObj.name || mediaObj.title;
        showToast(`Loaded details for "${mediaTitle.value}"`, "success");
      }
    }
  } catch (err: any) {
    console.error("Error fetching TMDB metadata:", err);
  } finally {
    isFetchingTmdb.value = false;
  }
};

const addCastRow = () => {
  castRows.value.push({
    actor_id: 0,
    character_name: "",
    voice_actor_id: null,
    performance: "dialogues",
    highlight: false
  });
};

const removeCastRow = (index: number) => {
  castRows.value.splice(index, 1);
};

const openCreatePersonModal = () => {
  newPersonFirstname.value = "";
  newPersonLastname.value = "";
  showCreatePersonModal.value = true;
};

const quickCreateVoiceActor = async () => {
  if (!newPersonFirstname.value || !newPersonLastname.value) return;
  isCreatingPerson.value = true;
  try {
    const { data, error } = await supabase
      .from("voice_actors")
      .insert([
        {
          firstname: newPersonFirstname.value.trim(),
          lastname: newPersonLastname.value.trim(),
          nationality: newPersonNationality.value.trim() || null
        }
      ])
      .select()
      .single();

    if (error) throw error;

    if (data) {
      showToast(`Created profile for ${data.firstname} ${data.lastname}!`, "success");
      await fetchVoiceActors();
      // If we have cast rows, auto assign to the last row
      if (castRows.value.length > 0) {
        castRows.value[castRows.value.length - 1].voice_actor_id = data.id;
      }
      showCreatePersonModal.value = false;
    }
  } catch (err: any) {
    console.error("Error creating voice actor:", err);
    showToast(err.message || "Failed to create voice actor profile", "error");
  } finally {
    isCreatingPerson.value = false;
  }
};

const saveMovieProject = async () => {
  if (!contentId.value) {
    showToast("Content ID is required.", "error");
    return;
  }

  isSaving.value = true;

  try {
    const projectPayload = {
      content_id: contentId.value,
      content_type: contentType.value,
      language: language.value || "fr-FR",
      studio_id: selectedStudioId.value || null,
      artistic_director: artisticDirector.value || null,
      adaptation: adaptation.value || null,
      recording: recording.value || null,
      editing: editing.value || null,
      mixing: mixing.value || null,
      project_manager: projectManager.value || null,
      creative_supervision: creativeSupervision.value || null,
      status: status.value || "validated"
    };

    let projectId = id ? Number(id) : null;

    if (isEditMode.value && projectId) {
      const { error: updateErr } = await supabase
        .from("dubbing_projects")
        .update(projectPayload)
        .eq("id", projectId);
      if (updateErr) throw updateErr;
    } else {
      const { data: newProj, error: insertErr } = await supabase
        .from("dubbing_projects")
        .insert([projectPayload])
        .select()
        .single();
      if (insertErr) throw insertErr;
      projectId = newProj.id;
    }

    // Save linked cast / work entries
    if (projectId && contentId.value) {
      // Upsert cast rows into work table
      for (const row of castRows.value) {
        if (!row.actor_id) continue;
        const workPayload: any = {
          dubbing_project_id: projectId,
          actor_id: row.actor_id,
          voice_actor_id: row.voice_actor_id || null,
          suggestions: row.character_name || null,
          performance: row.performance || "dialogues",
          highlight: row.highlight || false,
          status: "validated"
        };
        if (row.id) {
          workPayload.id = row.id;
        }

        await supabase.from("work").upsert([workPayload]);
      }
    }

    showToast("Movie project and dubbing team saved successfully!", "success");

    setTimeout(() => {
      router.push(localePath("/admin"));
    }, 1200);
  } catch (err: any) {
    console.error("Error saving movie project:", err);
    showToast(err.message || "Failed to save movie project.", "error");
  } finally {
    isSaving.value = false;
  }
};

const fetchSignedUrlsForAttachments = async (attachs: ProjectAttachment[]) => {
  if (attachs.length === 0) return;
  const paths = attachs.map(a => a.file_path);
  const { data, error } = await supabase.storage.from("project_attachments").createSignedUrls(paths, 3600);
  if (!error && data) {
    attachs.forEach((att) => {
      const match = data.find(d => d.path === att.file_path);
      if (match && match.signedUrl) {
        att.signedUrl = match.signedUrl;
      }
    });
  }
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!isEditMode.value || !id) {
    showToast("You must save the project before adding attachments.", "error");
    return;
  }

  isUploadingAttachment.value = true;
  try {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
    const compressedFile = await imageCompression(file, options);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('project_attachments')
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data, error: insertError } = await supabase
      .from('project_attachments')
      .insert({
        dubbing_project_id: Number(id),
        file_path: filePath,
        file_name: file.name,
        description: newAttachmentDescription.value
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await fetchSignedUrlsForAttachments([data]);
    attachments.value.unshift(data);
    newAttachmentDescription.value = "";
    showToast("Attachment uploaded successfully!", "success");
    target.value = '';
  } catch (err: any) {
    console.error("Error uploading attachment:", err);
    showToast(err.message || "Failed to upload attachment", "error");
  } finally {
    isUploadingAttachment.value = false;
  }
};

const deleteAttachment = async (attachmentId: number, filePath: string) => {
  if (!confirm("Are you sure you want to delete this attachment?")) return;

  try {
    const { error: dbError } = await supabase
      .from('project_attachments')
      .delete()
      .eq('id', attachmentId);

    if (dbError) throw dbError;

    const { error: storageError } = await supabase.storage
      .from('project_attachments')
      .remove([filePath]);

    if (storageError) {
      console.error("Storage deletion failed, but DB record was deleted:", storageError);
    }

    attachments.value = attachments.value.filter(a => a.id !== attachmentId);
    showToast("Attachment deleted successfully", "success");
  } catch (err: any) {
    console.error("Error deleting attachment:", err);
    showToast(err.message || "Failed to delete attachment", "error");
  }
};

await (async () => {
  await fetchStudios();
  await fetchVoiceActors();
  await fetchMovieProject();
})();
</script>
