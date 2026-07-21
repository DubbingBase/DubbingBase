<template>
  <ion-page>
    <AppPage>
      <AppHeader>
        <AppToolbar>
          <template #start>
            <AppBackButton />
          </template>
          <AppTitle>{{
            isEditMode ? "Edit Dubbing Project" : "Create Dubbing Project"
          }}</AppTitle>
        </AppToolbar>
      </AppHeader>

      <AppContent class="edit-dubbing-project-page">
        <div v-if="isLoading" class="loading-state">
          <LoadingSpinner name="crescent" />
          <p class="loading-text">Loading dubbing project data...</p>
        </div>

        <form v-else @submit.prevent="saveProject" class="form-container">
          <!-- Media Information Card (Read-only overview for TMDB media) -->
          <div class="form-card">
            <div class="card-header-flex">
              <h3 class="card-title no-border">Media Information</h3>
              <button
                v-if="!isEditMode"
                type="button"
                @click="showMediaSearchModal = true"
                class="btn-primary flex items-center gap-1.5"
              >
                <Search class="w-3.5 h-3.5" />
                <span>Search TMDB</span>
              </button>
            </div>

            <div class="space-y-3">
              <div
                class="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <div class="text-sm font-bold text-white">
                    {{ mediaTitle || "Loading media title..." }}
                  </div>
                  <div
                    class="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#a0a0a0]"
                  >
                    <span
                      class="px-2 py-0.5 bg-[#2a2a2a] rounded uppercase font-bold text-[10px] text-blue-400"
                    >
                      {{ contentType }}
                    </span>
                    <span
                      >TMDB ID:
                      <strong class="text-white">{{
                        contentId || id
                      }}</strong></span
                    >
                    <span
                      >Language:
                      <strong class="text-white">{{
                        language || "fr"
                      }}</strong></span
                    >
                  </div>
                </div>
                <button
                  v-if="!isEditMode"
                  type="button"
                  @click="showMediaSearchModal = true"
                  class="text-xs text-blue-400 font-semibold"
                >
                  Change ↵
                </button>
              </div>
            </div>
          </div>

          <!-- Technical Dubbing Team Card -->
          <div class="form-card">
            <h3 class="card-title">Technical Dubbing Team</h3>

            <div class="space-y-4">
              <div class="form-group">
                <div class="flex items-center justify-between">
                  <label class="form-label">Dubbing Studio</label>
                  <div class="flex items-center gap-3">
                    <router-link
                      :to="`/studio-edit/new`"
                      class="text-xs text-blue-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <span>+ New Studio</span>
                    </router-link>
                    <router-link
                      v-if="selectedStudioId"
                      :to="`/studio/${selectedStudioId}`"
                      class="text-xs text-blue-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <span>View Studio</span>
                      <span>↗</span>
                    </router-link>
                  </div>
                </div>

                <button
                  type="button"
                  @click="openStudioPicker"
                  class="picker-button"
                >
                  <div class="flex items-center gap-2 truncate">
                    <Building2 class="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span
                      v-if="studio"
                      class="truncate font-semibold text-white"
                      >{{ studio }}</span
                    >
                    <span v-else class="text-slate-400"
                      >-- Select Studio --</span
                    >
                  </div>
                  <ChevronRight class="w-4 h-4 text-slate-500 flex-shrink-0" />
                </button>
              </div>
            </div>
          </div>

          <!-- Dubbing Project Crew Card -->
          <div class="form-card mt-6">
            <div class="card-header-flex">
              <h3 class="card-title no-border">Dubbing Project Crew</h3>
              <div class="action-buttons">
                <button type="button" @click="addCrewRow" class="btn-primary">
                  + Add Crew Row
                </button>
              </div>
            </div>

            <div class="cast-rows-list">
              <div
                v-for="(row, index) in dubbingCrew"
                :key="index"
                class="cast-row-card"
              >
                <div class="row-header">
                  <span class="row-badge">Crew Member #{{ index + 1 }}</span>
                  <button
                    type="button"
                    @click="removeCrewRow(index)"
                    class="btn-danger-icon"
                  >
                    Delete
                  </button>
                </div>

                <div class="grid-2">
                  <div class="form-group">
                    <div class="flex items-center justify-between mb-1">
                      <label class="form-label !mb-0">Job Role *</label>
                      <button
                        type="button"
                        @click="openCreateJobModal(index)"
                        class="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                      >
                        + New
                      </button>
                    </div>
                    <select v-model="row.job_id" class="form-select">
                      <option disabled :value="null">-- Select Job --</option>
                      <option
                        v-for="j in availableJobs"
                        :key="j.id"
                        :value="j.id"
                      >
                        {{ j.name }}
                      </option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label class="form-label">Person *</label>
                    <div class="input-with-action">
                      <button
                        type="button"
                        @click="openCrewPicker(index)"
                        class="picker-button flex-1"
                      >
                        <div class="flex items-center gap-2 truncate">
                          <User class="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <span
                            v-if="row.person_id"
                            class="truncate font-semibold text-white"
                          >
                            {{ getCrewDisplayName(row) }}
                          </span>
                          <span v-else class="text-slate-400"
                            >-- Select Person --</span
                          >
                        </div>
                        <ChevronRight
                          class="w-4 h-4 text-slate-500 flex-shrink-0"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="dubbingCrew.length === 0" class="empty-cast">
                No crew mapped yet. Click "+ Add Crew Row" to assign crew
                members.
              </div>
            </div>
          </div>

          <!-- Voice Actor Credits Card -->
          <div class="form-card">
            <div class="card-header-flex">
              <h3 class="card-title no-border">Voice Actor Credits</h3>
              <div class="action-buttons">
                <button
                  type="button"
                  @click="showCreatePersonModal = true"
                  class="btn-secondary"
                >
                  + New VA
                </button>
                <button type="button" @click="addCastRow" class="btn-primary">
                  + Add Row
                </button>
              </div>
            </div>

            <div class="cast-rows-list">
              <div
                v-for="(row, index) in castRows"
                :key="index"
                class="cast-row-card"
              >
                <div class="row-header">
                  <span class="row-badge">Credit #{{ index + 1 }}</span>
                  <button
                    type="button"
                    @click="removeCastRow(index)"
                    class="btn-danger-icon"
                  >
                    Delete
                  </button>
                </div>

                <div class="grid-2">
                  <!-- TMDB Cast Member Picker -->
                  <div class="form-group">
                    <label class="form-label"
                      >Original TMDB Cast Member *</label
                    >
                    <button
                      type="button"
                      @click="openCastPicker(index)"
                      class="picker-button"
                    >
                      <div class="flex items-center gap-2 truncate">
                        <User class="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span
                          v-if="row.actor_id"
                          class="truncate font-semibold text-white"
                        >
                          {{ getActorDisplayName(row) }}
                        </span>
                        <span v-else class="text-slate-400"
                          >-- Select Cast --</span
                        >
                      </div>
                      <ChevronRight
                        class="w-4 h-4 text-slate-500 flex-shrink-0"
                      />
                    </button>
                  </div>

                  <!-- French Voice Actor Picker -->
                  <div class="form-group">
                    <label class="form-label">French Voice Actor</label>
                    <div class="input-with-action">
                      <button
                        type="button"
                        @click="openVoiceActorPicker(index)"
                        class="picker-button flex-1"
                      >
                        <div class="flex items-center gap-2 truncate">
                          <Mic class="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <span
                            v-if="row.voice_actor_id"
                            class="truncate font-semibold text-white"
                          >
                            {{ getVoiceActorDisplayName(row) }}
                          </span>
                          <span v-else class="text-slate-400"
                            >-- Select VA --</span
                          >
                        </div>
                        <ChevronRight
                          class="w-4 h-4 text-slate-500 flex-shrink-0"
                        />
                      </button>
                      <router-link
                        v-if="row.voice_actor_id"
                        :to="`/voice-actor-profile/${row.voice_actor_id}`"
                        class="icon-link-btn"
                      >
                        ↗
                      </router-link>
                    </div>
                  </div>
                </div>

                <div class="row-footer">
                  <div class="form-group flex-1">
                    <label class="form-label">Performance</label>
                    <select v-model="row.performance" class="form-select">
                      <option value="dialogues">Dialogues</option>
                      <option value="chant">Chant</option>
                      <option value="ambiances">Ambiances</option>
                    </select>
                  </div>

                  <label class="checkbox-label">
                    <input
                      v-model="row.highlight"
                      type="checkbox"
                      class="custom-checkbox"
                    />
                    <span>Highlight</span>
                  </label>
                </div>
              </div>

              <div v-if="castRows.length === 0" class="empty-cast">
                No credits mapped yet. Click "+ Add Row" to assign voice actors.
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="submit-bar">
            <AppButton expand="block" type="submit" :disabled="isSaving">
              <LoadingSpinner v-if="isSaving" name="crescent" inline />
              {{ isSaving ? "Saving Project..." : "Save Dubbing Project" }}
            </AppButton>
          </div>
        </form>

        <!-- TMDB Media Search Modal -->
        <AppModal
          :is-open="showMediaSearchModal"
          @didDismiss="showMediaSearchModal = false"
        >
          <div class="modal-body">
            <h3 class="modal-title">Search TMDB Media</h3>
            <div class="form-group">
              <input
                v-model="mediaSearchQuery"
                type="text"
                placeholder="Type movie or show title (e.g. Fight Club)..."
                class="form-input"
                @keyup.enter="searchMedia"
              />
            </div>
            <button
              type="button"
              @click="searchMedia"
              class="btn-primary w-full py-2"
            >
              Search TMDB
            </button>

            <div v-if="isSearchingMedia" class="py-6 text-center">
              <LoadingSpinner name="crescent" />
            </div>

            <div
              v-else-if="mediaSearchResults.length > 0"
              class="search-results-list max-h-60 overflow-y-auto space-y-2 pt-2"
            >
              <div
                v-for="item in mediaSearchResults"
                :key="item.id"
                @click="selectMedia(item)"
                class="search-result-card flex items-center gap-3 p-2.5 bg-[#141414] hover:bg-[#252525] border border-[#2a2a2a] rounded-xl cursor-pointer"
              >
                <div
                  class="w-10 h-14 bg-[#2a2a2a] rounded overflow-hidden flex-shrink-0"
                >
                  <img
                    v-if="item.poster_path"
                    :src="`https://image.tmdb.org/t/p/w92${item.poster_path}`"
                    class="w-full h-full object-cover"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-bold text-white truncate">
                    {{ item.title || item.name }}
                  </div>
                  <div
                    class="text-[10px] text-[#a0a0a0] flex items-center gap-2 mt-1"
                  >
                    <span
                      class="px-1.5 py-0.5 bg-[#2a2a2a] rounded uppercase font-semibold text-[9px]"
                      >{{ item.media_type }}</span
                    >
                    <span>ID: {{ item.id }}</span>
                    <span v-if="item.release_date || item.first_air_date">
                      ({{
                        (item.release_date || item.first_air_date).slice(0, 4)
                      }})
                    </span>
                  </div>
                </div>
                <span class="text-xs text-blue-400 font-semibold"
                  >Select ↵</span
                >
              </div>
            </div>
          </div>
        </AppModal>

        <!-- Studio Search Picker Modal -->
        <AppModal
          :is-open="showStudioSearchModal"
          @didDismiss="showStudioSearchModal = false"
        >
          <div class="modal-body">
            <h3 class="modal-title">Select Dubbing Studio</h3>
            <div class="form-group">
              <input
                v-model="studioSearchQuery"
                type="text"
                placeholder="Search studio by name..."
                class="form-input"
                @input="searchStudios"
              />
            </div>

            <div v-if="isSearchingStudios" class="py-6 text-center">
              <LoadingSpinner name="crescent" />
            </div>

            <div
              v-else-if="studioSearchResults.length > 0"
              class="search-results-list max-h-60 overflow-y-auto space-y-2 pt-2"
            >
              <div
                v-for="s in studioSearchResults"
                :key="s.id"
                @click="selectStudio(s)"
                class="search-result-card flex items-center justify-between p-3 bg-[#141414] hover:bg-[#252525] border border-[#2a2a2a] rounded-xl cursor-pointer"
              >
                <div class="flex items-center gap-3">
                  <Building2 class="w-4 h-4 text-blue-400" />
                  <div>
                    <div class="text-xs font-bold text-white">{{ s.name }}</div>
                    <div
                      v-if="s.city || s.country"
                      class="text-[10px] text-[#a0a0a0]"
                    >
                      {{ [s.city, s.country].filter(Boolean).join(", ") }}
                    </div>
                  </div>
                </div>
                <span class="text-xs text-blue-400 font-semibold"
                  >Select ↵</span
                >
              </div>
            </div>

            <div v-else class="py-6 text-center text-xs text-slate-500">
              No studios found.
            </div>
          </div>
        </AppModal>

        <!-- TMDB Cast Search Picker Modal -->
        <TmdbPersonSearchModal
          :is-open="showCastSearchModal"
          :persons="tmdbCastList"
          @close="showCastSearchModal = false"
          @select="selectTmdbCastMember"
        />

        <!-- Voice Actor Search Picker Modal -->
        <PersonSearchModal
          :is-open="showVoiceActorSearchModal"
          @close="showVoiceActorSearchModal = false"
          @select="selectVoiceActor"
          @create-new="
            showCreatePersonModal = true;
            showVoiceActorSearchModal = false;
          "
        />

        <!-- Inline Create Person Modal -->
        <AppModal
          :is-open="showCreatePersonModal"
          @didDismiss="showCreatePersonModal = false"
        >
          <div class="modal-body">
            <h3 class="modal-title">Create New Person</h3>
            <div class="space-y-4">
              <div class="form-group">
                <label class="form-label">First Name *</label>
                <input
                  v-model="newPersonFirstname"
                  placeholder="First Name"
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Last Name *</label>
                <input
                  v-model="newPersonLastname"
                  placeholder="Last Name"
                  class="form-input"
                />
              </div>
            </div>
            <div class="modal-actions">
              <AppButton fill="outline" @click="showCreatePersonModal = false"
                >Cancel</AppButton
              >
              <AppButton
                @click="quickCreateVoiceActor"
                :disabled="!newPersonFirstname || !newPersonLastname"
              >
                Save & Assign
              </AppButton>
            </div>
          </div>
        </AppModal>

        <!-- Inline Create Job Modal -->
        <AppModal
          :is-open="showCreateJobModal"
          @didDismiss="showCreateJobModal = false"
        >
          <div class="modal-body">
            <h3 class="modal-title">Create New Job Role</h3>
            <div class="space-y-4">
              <div class="form-group">
                <label class="form-label">Job Name *</label>
                <input
                  v-model="newJobName"
                  placeholder="Job Name (e.g. Director)"
                  class="form-input"
                  @keyup.enter="quickCreateJob"
                />
              </div>
            </div>
            <div class="modal-actions">
              <AppButton fill="outline" @click="showCreateJobModal = false"
                >Cancel</AppButton
              >
              <AppButton
                @click="quickCreateJob"
                :disabled="!newJobName"
              >
                Save & Assign
              </AppButton>
            </div>
          </div>
        </AppModal>
      </AppContent>
    </AppPage>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage } from "@ionic/vue";
import AppPage from "@/components/common/layout/AppPage.vue";
import AppHeader from "@/components/common/layout/AppHeader.vue";
import AppToolbar from "@/components/common/layout/AppToolbar.vue";
import AppTitle from "@/components/common/layout/AppTitle.vue";
import AppContent from "@/components/common/layout/AppContent.vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppModal from "@/components/common/AppModal.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import TmdbPersonSearchModal from "@/components/TmdbPersonSearchModal.vue";
import { PersonData } from "@/components/PersonItem.vue";
import { enqueueAndProcessMedia } from "@/api/mediaQueue";
import PersonSearchModal from "@/components/PersonSearchModal.vue";

import Search from "~icons/lucide/search";
import Building2 from "~icons/lucide/building-2";
import User from "~icons/lucide/user";
import Mic from "~icons/lucide/mic";
import ChevronRight from "~icons/lucide/chevron-right";

import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "@/api/supabase";
import { onIonViewWillEnter } from "@ionic/vue";

const route = useRoute();
const router = useRouter();
const id = computed(() => (route.params.id as string) || (route.path.endsWith('/new') ? 'new' : undefined));
const isEditMode = computed(() => !!id.value && id.value !== "new");

// Form state
const dbProjectId = ref<number | null>(null);
const contentId = ref<number | null>(null);
const mediaTitle = ref("");
const contentType = ref("movie");
const language = ref("fr");
const studio = ref("");
const selectedStudioId = ref<number | null>(null);
const studiosList = ref<Array<{ id: number; name: string }>>([]);

const dubbingCrew = ref<any[]>([]);
const availableJobs = ref<Array<{ id: number; name: string }>>([]);
const activeCrewRowIndex = ref<number | null>(null);

const addCrewRow = () => {
  dubbingCrew.value.push({ job_id: null, person_id: null });
};

const removeCrewRow = (index: number) => {
  dubbingCrew.value.splice(index, 1);
};

const openCrewPicker = (index: number) => {
  activeCrewRowIndex.value = index;
  activeCastRowIndexForVa.value = null;
  showVoiceActorSearchModal.value = true;
};

const getCrewDisplayName = (row: any) => {
  if (row.firstname && row.lastname) return `${row.firstname} ${row.lastname}`;
  const match = voiceActorsList.value.find(
    (va) => Number(va.id) === Number(row.person_id),
  );
  if (match) return `${match.firstname} ${match.lastname}`;
  return `Person #${row.person_id}`;
};

const voiceActorsList = ref<
  Array<{ id: number; firstname: string; lastname: string }>
>([]);

interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
}
const tmdbCastList = ref<TmdbCastMember[]>([]);

// Media Search Modal State
const showMediaSearchModal = ref(false);
const mediaSearchQuery = ref("");
const mediaSearchResults = ref<any[]>([]);
const isSearchingMedia = ref(false);

// Studio Search Picker Modal State
const showStudioSearchModal = ref(false);
const studioSearchQuery = ref("");
const studioSearchResults = ref<any[]>([]);
const isSearchingStudios = ref(false);

// TMDB Cast Search Picker Modal State
const showCastSearchModal = ref(false);
const activeCastRowIndexForCast = ref<number | null>(null);

// Voice Actor Search Picker Modal State
const showVoiceActorSearchModal = ref(false);
const activeCastRowIndexForVa = ref<number | null>(null);

interface CastRow {
  id?: number;
  actor_id: number;
  actor_name?: string;
  character_name?: string;
  voice_actor_id: number | null;
  voice_actor_name?: string;
  performance: string;
  highlight: boolean;
}
const castRows = ref<CastRow[]>([]);

const isLoading = ref(false);
const isSaving = ref(false);
const showCreatePersonModal = ref(false);
const newPersonFirstname = ref("");
const newPersonLastname = ref("");

// Create Job Modal State
const showCreateJobModal = ref(false);
const newJobName = ref("");
const activeJobRowIndex = ref<number | null>(null);

const openCreateJobModal = (index: number) => {
  activeJobRowIndex.value = index;
  showCreateJobModal.value = true;
};

const openStudioPicker = () => {
  studioSearchQuery.value = "";
  searchStudios();
  showStudioSearchModal.value = true;
};

const searchStudios = async () => {
  isSearchingStudios.value = true;
  try {
    let query = supabase
      .from("studios")
      .select("*")
      .order("name", { ascending: true });
    if (studioSearchQuery.value.trim()) {
      query = query.ilike("name", `%${studioSearchQuery.value.trim()}%`);
    }
    const { data } = await query.limit(25);
    studioSearchResults.value = data || [];
  } catch (err) {
    console.error("Error searching studios:", err);
  } finally {
    isSearchingStudios.value = false;
  }
};

const selectStudio = (s: any) => {
  selectedStudioId.value = s.id;
  studio.value = s.name;
  showStudioSearchModal.value = false;
};

const openVoiceActorPicker = (index: number) => {
  activeCastRowIndexForVa.value = index;
  activeCrewRowIndex.value = null;
  showVoiceActorSearchModal.value = true;
};

const selectVoiceActor = (va: any) => {
  if (
    activeCrewRowIndex.value !== null &&
    dubbingCrew.value[activeCrewRowIndex.value]
  ) {
    dubbingCrew.value[activeCrewRowIndex.value].person_id = va.id;
    dubbingCrew.value[activeCrewRowIndex.value].firstname = va.firstname;
    dubbingCrew.value[activeCrewRowIndex.value].lastname = va.lastname;
  } else if (
    activeCastRowIndexForVa.value !== null &&
    castRows.value[activeCastRowIndexForVa.value]
  ) {
    castRows.value[activeCastRowIndexForVa.value].voice_actor_id = va.id;
    castRows.value[activeCastRowIndexForVa.value].voice_actor_name =
      `${va.firstname} ${va.lastname}`;
  }
  showVoiceActorSearchModal.value = false;
};

const openCastPicker = (index: number) => {
  activeCastRowIndexForCast.value = index;
  showCastSearchModal.value = true;
};

const selectTmdbCastMember = (c: any) => {
  if (
    activeCastRowIndexForCast.value !== null &&
    castRows.value[activeCastRowIndexForCast.value]
  ) {
    castRows.value[activeCastRowIndexForCast.value].actor_id = c.id;
    castRows.value[activeCastRowIndexForCast.value].actor_name = c.name;
    castRows.value[activeCastRowIndexForCast.value].character_name =
      c.character;
  }
  showCastSearchModal.value = false;
};

const getActorDisplayName = (row: CastRow) => {
  if (row.actor_name && row.character_name) {
    return `${row.actor_name} (as ${row.character_name})`;
  }
  const match = tmdbCastList.value.find(
    (c) => Number(c.id) === Number(row.actor_id),
  );
  if (match) {
    return `${match.name} (as ${match.character})`;
  }
  return `Actor ID #${row.actor_id}`;
};

const getVoiceActorDisplayName = (row: CastRow) => {
  if (row.voice_actor_name) return row.voice_actor_name;
  const match = voiceActorsList.value.find(
    (va) => Number(va.id) === Number(row.voice_actor_id),
  );
  if (match) return `${match.firstname} ${match.lastname}`;
  if (row.voice_actor_id) return `Voice Actor #${row.voice_actor_id}`;
  return "-- Select VA --";
};

const fetchJobs = async () => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("id, name")
      .order("name", { ascending: true });
    if (error) throw error;
    availableJobs.value = data || [];
  } catch (err) {
    console.error("Error fetching jobs list:", err);
  }
};

const fetchStudios = async () => {
  try {
    const { data, error } = await supabase
      .from("studios")
      .select("id, name")
      .order("name", { ascending: true });
    if (error) throw error;
    studiosList.value = data || [];
  } catch (err) {
    console.error("Error fetching studios list:", err);
  }
};

const fetchVoiceActors = async () => {
  try {
    const { data, error } = await supabase
      .from("voice_actors")
      .select("id, firstname, lastname")
      .order("lastname", { ascending: true });
    if (error) throw error;
    voiceActorsList.value = data || [];
  } catch (err) {
    console.error("Error fetching voice actors list:", err);
  }
};

const fetchTmdbCast = async (tmdbId: number, targetType?: string) => {
  const currentType = targetType || contentType.value;
  const isShow =
    currentType === "tv" || currentType === "show" || currentType === "serie";
  let functionName = isShow ? "show" : "movie";

  try {
    let { data } = await supabase.functions.invoke(functionName, {
      body: { id: tmdbId },
    });

    if (!data?.movie && !data?.serie) {
      const altFunctionName = functionName === "show" ? "movie" : "show";
      const altRes = await supabase.functions.invoke(altFunctionName, {
        body: { id: tmdbId },
      });
      if (altRes.data && (altRes.data.movie || altRes.data.serie)) {
        data = altRes.data;
        functionName = altFunctionName;
        if (altFunctionName === "show") contentType.value = "tv";
        else contentType.value = "movie";
      }
    }

    if (data) {
      const mediaObj = data.serie || data.movie || data;
      if (mediaObj?.name || mediaObj?.title || data?.title || data?.name) {
        mediaTitle.value =
          mediaObj?.name || mediaObj?.title || data?.title || data?.name;
      }

      const rawCast = data.serie
        ? data.aggregateCredits?.cast || mediaObj?.credits?.cast || []
        : mediaObj?.credits?.cast || [];

      const rawCrew = data.serie
        ? data.aggregateCredits?.crew || mediaObj?.credits?.crew || []
        : mediaObj?.credits?.crew || [];

      const mappedCast = rawCast.map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character || (c.roles && c.roles[0]?.character) || "Role",
        isCrew: false,
      }));

      const mappedCrew = rawCrew.map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.job || (c.jobs && c.jobs[0]?.job) || "Crew",
        isCrew: true,
      }));

      tmdbCastList.value = [...mappedCast, ...mappedCrew];
    }
  } catch (err) {
    console.warn("Could not fetch TMDB cast automatically:", err);
  }
};

const searchMedia = async () => {
  if (!mediaSearchQuery.value.trim() || mediaSearchQuery.value.length < 2)
    return;
  isSearchingMedia.value = true;
  try {
    const { data } = await supabase.functions.invoke("search", {
      body: { query: mediaSearchQuery.value.trim() },
    });
    if (data?.results) {
      mediaSearchResults.value = data.results.filter(
        (r: any) => r.media_type === "movie" || r.media_type === "tv",
      );
    }
  } catch (err) {
    console.error("Error searching media:", err);
  } finally {
    isSearchingMedia.value = false;
  }
};

const selectMedia = async (media: any) => {
  contentId.value = media.id;
  mediaTitle.value = media.title || media.name || "";
  contentType.value = media.media_type === "tv" ? "tv" : "movie";
  showMediaSearchModal.value = false;
  await fetchTmdbCast(media.id, contentType.value);
};

const updateCastRowsActorNames = () => {
  for (const row of castRows.value) {
    if (row.actor_id) {
      const match = tmdbCastList.value.find(
        (c) => Number(c.id) === Number(row.actor_id),
      );
      if (match) {
        row.actor_name = match.name;
        row.character_name = match.character;
      }
    }
  }
};

const updateCastRowsVoiceActorNames = () => {
  for (const row of castRows.value) {
    if (row.voice_actor_id && !row.voice_actor_name) {
      const match = voiceActorsList.value.find(
        (va) => Number(va.id) === Number(row.voice_actor_id),
      );
      if (match) {
        row.voice_actor_name = `${match.firstname} ${match.lastname}`;
      }
    }
  }
};

const fetchProjectDetails = async () => {
  if (!id.value || (id.value === "new" && !route.query.contentId)) return;
  isLoading.value = true;
  try {
    const numericId = Number(id.value);
    let project = null;

    if (!isNaN(numericId)) {
      const { data: projects } = await supabase
        .from("dubbing_projects")
        .select("*")
        .or(`id.eq.${numericId},content_id.eq.${numericId}`)
        .limit(1);
      if (projects && projects.length > 0) {
        project = projects[0];
      }
    }

    if (project) {
      dbProjectId.value = project.id;
      if (Number(id.value) !== project.id) {
        router.replace(`/edit-dubbing-project/${project.id}`);
      }
      contentId.value = project.content_id;
      contentType.value = project.content_type || "movie";
      language.value = project.language || "fr";
      selectedStudioId.value = project.studio_id || null;

      // Fetch dubbing crew
      const { data: crewData } = await supabase
        .from("dubbing_project_crew")
        .select("*, voice_actors(firstname, lastname)")
        .eq("dubbing_project_id", project.id);

      if (crewData) {
        dubbingCrew.value = crewData.map((c) => ({
          job_id: c.job_id,
          person_id: c.person_id,
          firstname: c.voice_actors?.firstname,
          lastname: c.voice_actors?.lastname,
        }));
      }

      if (selectedStudioId.value) {
        const found = studiosList.value.find(
          (s) => s.id === selectedStudioId.value,
        );
        if (found) studio.value = found.name;
      }
    } else if (!isNaN(numericId)) {
      // If no project exists yet in DB for this TMDB ID, treat as project for this contentId
      contentId.value = numericId;
    } else if (id.value === "new" && route.query.contentId) {
      contentId.value = Number(route.query.contentId);
      if (route.query.contentType) {
        contentType.value = route.query.contentType as string;
      }
    }

    // Fetch works for project.id
    if (project?.id) {
      const { data: works } = await supabase
        .from("work")
        .select("*, voice_actors(id, firstname, lastname)")
        .eq("dubbing_project_id", project.id);

      if (works) {
        castRows.value = works.map((w: any) => ({
          id: w.id,
          actor_id: w.actor_id,
          voice_actor_id: w.voice_actor_id,
          voice_actor_name: w.voice_actors
            ? `${w.voice_actors.firstname} ${w.voice_actors.lastname}`
            : undefined,
          performance: w.performance || "dialogues",
          highlight: w.highlight || false,
        }));
      }
    }

    // Fetch TMDB Cast & Media title
    if (contentId.value) {
      await fetchTmdbCast(contentId.value, contentType.value);
      updateCastRowsActorNames();
    }
    updateCastRowsVoiceActorNames();
  } catch (err) {
    console.error("Error fetching project details:", err);
  } finally {
    isLoading.value = false;
  }
};

const addCastRow = () => {
  castRows.value.push({
    actor_id: 0,
    voice_actor_id: null,
    performance: "dialogues",
    highlight: false,
  });
};

const removeCastRow = (index: number) => {
  castRows.value.splice(index, 1);
};

const quickCreateVoiceActor = async () => {
  if (!newPersonFirstname.value || !newPersonLastname.value) return;
  try {
    const { data, error } = await supabase
      .from("voice_actors")
      .insert([
        {
          firstname: newPersonFirstname.value.trim(),
          lastname: newPersonLastname.value.trim(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    if (data) {
      await fetchVoiceActors();
      selectVoiceActor(data); // Auto-assign using the existing selection logic!
      showCreatePersonModal.value = false;
      newPersonFirstname.value = "";
      newPersonLastname.value = "";
    }
  } catch (err) {
    console.error("Error quick creating voice actor:", err);
  }
};

const quickCreateJob = async () => {
  if (!newJobName.value) return;
  try {
    const { data, error } = await supabase
      .from("jobs")
      .insert([{ name: newJobName.value.trim() }])
      .select()
      .single();

    if (error) throw error;
    if (data) {
      await fetchJobs();
      if (activeJobRowIndex.value !== null && activeJobRowIndex.value >= 0) {
        dubbingCrew.value[activeJobRowIndex.value].job_id = data.id;
      }
      showCreateJobModal.value = false;
      newJobName.value = "";
      activeJobRowIndex.value = null;
    }
  } catch (err) {
    console.error("Error quick creating job:", err);
  }
};

const saveProject = async () => {
  if (!contentId.value) return;
  isSaving.value = true;
  try {
    const projectPayload = {
      content_id: contentId.value,
      content_type: contentType.value,
      language: language.value || "fr",
      studio_id: selectedStudioId.value || null,
      status: "validated",
    };

    let projectId = dbProjectId.value;

    if (projectId) {
      const { error } = await supabase
        .from("dubbing_projects")
        .update(projectPayload)
        .eq("id", projectId);
      if (error) throw error;
    } else {
      // Ensure the media exists in our database before creating a foreign key to it
      try {
        await enqueueAndProcessMedia({
          tmdbId: contentId.value,
          mediaType: contentType.value,
        });
      } catch (mediaErr: any) {
        console.warn(
          "Media might already exist or error preparing media:",
          mediaErr,
        );
        // We continue in case it already exists and the error is just a unique constraint violation
      }

      const { data: newProj, error } = await supabase
        .from("dubbing_projects")
        .insert([projectPayload])
        .select()
        .single();
      if (error) throw error;
      if (newProj) projectId = newProj.id;
    }

    if (projectId) {
      // Save Dubbing Crew
      await supabase
        .from("dubbing_project_crew")
        .delete()
        .eq("dubbing_project_id", projectId);
      if (dubbingCrew.value.length > 0) {
        const crewPayloads = dubbingCrew.value.map((c) => ({
          dubbing_project_id: projectId,
          person_id: c.person_id,
          job_id: c.job_id,
        }));
        await supabase.from("dubbing_project_crew").insert(crewPayloads);
      }
    }

    if (projectId && contentId.value) {
      for (const row of castRows.value) {
        if (!row.actor_id) continue;
        const workPayload: any = {
          dubbing_project_id: projectId,
          actor_id: row.actor_id,
          voice_actor_id: row.voice_actor_id || null,
          performance: row.performance || "dialogues",
          highlight: row.highlight || false,
          status: "validated",
        };
        if (row.id) workPayload.id = row.id;

        await supabase.from("work").upsert([workPayload]);
      }
    }

    router.back();
  } catch (err: any) {
    console.error("Error saving dubbing project:", err);
    alert(err.message || "Error saving dubbing project");
  } finally {
    isSaving.value = false;
  }
};

onIonViewWillEnter(async () => {
  // Reset critical form state when entering the page
  dbProjectId.value = null;
  contentId.value = null;
  mediaTitle.value = "";
  contentType.value = "movie";
  language.value = "fr";
  studio.value = "";
  selectedStudioId.value = null;
  dubbingCrew.value = [];
  castRows.value = [];
  
  await fetchJobs();
  await fetchStudios();
  await fetchVoiceActors();
  await fetchProjectDetails();
});
</script>

<style scoped lang="scss">
.edit-dubbing-project-page {
  padding: 16px;
  background-color: #121212;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}

.loading-text {
  font-size: 12px;
  color: #a0a0a0;
  margin-top: 12px;
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-card {
  background: #1d1d1d;
  border: 1px solid #2a2a2a;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.card-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #3b82f6;
  border-bottom: 1px solid #2a2a2a;
  padding-bottom: 10px;
  margin-bottom: 16px;

  &.no-border {
    border-bottom: none;
    padding-bottom: 0;
    margin-bottom: 0;
  }
}

.card-header-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #2a2a2a;
  padding-bottom: 12px;
  margin-bottom: 16px;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: #2563eb;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #1d4ed8;
  }
}

.btn-secondary {
  background: #2a2a2a;
  color: #60a5fa;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #3a3a3a;
  cursor: pointer;

  &:hover {
    background: #333333;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #a0a0a0;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  background-color: #121212;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  &::placeholder {
    color: #555555;
  }
}

.picker-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background-color: #121212;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  color: #ffffff;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover,
  &:focus {
    border-color: #3b82f6;
    background-color: #171717;
  }
}

.form-select {
  width: 100%;
  padding: 10px 36px 10px 14px;
  background-color: #121212;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a0a0a0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.cast-rows-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cast-row-card {
  background: #141414;
  border: 1px solid #262626;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row-badge {
  font-size: 11px;
  font-weight: 700;
  color: #60a5fa;
  text-transform: uppercase;
}

.btn-danger-icon {
  background: transparent;
  color: #f87171;
  font-size: 11px;
  border: none;
  cursor: pointer;
  padding: 2px 6px;

  &:hover {
    text-decoration: underline;
  }
}

.input-with-action {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 10px;
  color: #60a5fa;
  font-size: 12px;
  text-decoration: none;
}

.row-footer {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding-top: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #a0a0a0;
  cursor: pointer;
  padding-bottom: 10px;
}

.custom-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  accent-color: #2563eb;
}

.empty-cast {
  text-align: center;
  padding: 20px 0;
  font-size: 12px;
  color: #666666;
}

.submit-bar {
  margin-top: 8px;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  border-bottom: 1px solid #2a2a2a;
  padding-bottom: 8px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
}
</style>
