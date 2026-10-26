<template>
  <div class="admin-project-editor max-w-6xl mx-auto space-y-6">
    <!-- Header -->
    <div
      class="theme-surface-overlay p-6 rounded-2xl border theme-border flex justify-between items-center shadow-xl"
    >
      <div>
        <h3 class="text-xl font-bold theme-text flex items-center gap-2">
          <SmileIcon class="w-6 h-6 theme-status-warning-text" />
          {{
            isEditMode
              ? "Modifier le projet de jouet interactif / conteuse"
              : "Créer un projet de jouet interactif / conteuse"
          }}
        </h3>
        <p class="text-sm theme-text-muted mt-1">
          {{
            isEditMode
              ? `Mise à jour du projet #${projectIdParam}`
              : "Informations sur le produit, fabricant, studio et comédiens."
          }}
        </p>
      </div>
      <NuxtLink
        :to="parsedToyId ? localePath(`/toy/${parsedToyId}`) : localePath('/')"
        class="text-xs font-semibold px-4 py-2.5 theme-surface-muted theme-hover-surface-muted theme-text-secondary theme-hover-text rounded-xl border theme-border transition-colors flex items-center space-x-2"
      >
        <span>{{ parsedToyId ? "← Retour à l'objet" : "← Accueil" }}</span>
      </NuxtLink>
    </div>

    <!-- Navigation Tabs -->
    <div v-if="parsedToyId" class="flex flex-wrap gap-2 pb-2 border-b theme-border">
      <NuxtLink
        v-for="project in toyDubbingProjects"
        :key="project.id"
        :to="localePath(`/toy/${parsedToyId}/projects/${project.id}/edit`)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
        :class="
          project.id === Number(projectIdParam)
            ? 'theme-primary-bg theme-primary-border'
            : 'theme-surface-overlay theme-text-secondary theme-border theme-hover-surface-muted'
        "
      >
        {{ getDisplayLanguage(project.language) }}
        <span v-if="project.studios?.name" class="opacity-75 text-xs ml-1"
          >({{ project.studios.name }})</span
        >
      </NuxtLink>
      <NuxtLink
        :to="localePath(`/toy/${parsedToyId}/projects/new`)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-dashed"
        :class="
          projectIdParam === 'new'
            ? 'theme-status-warning theme-status-warning-text border'
            : 'theme-surface-overlay theme-text-muted theme-border theme-hover-surface-muted theme-hover-text'
        "
        >{{ $t("common.addLanguage") }}</NuxtLink
      >
    </div>

    <!-- Loading overlay -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center py-24 gap-4 theme-text-muted"
    >
      <Loader2Icon class="w-8 h-8 animate-spin theme-status-warning-text" />
      <span class="text-sm">{{ $t("common.loadingProjectData") }}</span>
    </div>

    <form v-else @submit.prevent="saveToyProject" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Media Metadata Card (Left Column) -->
        <div
          class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-5 h-fit shadow-xl"
        >
          <h4
            class="text-sm font-bold theme-text uppercase tracking-wider border-b theme-border pb-3 flex items-center justify-between"
          >
            <span>{{ $t("toyEditor.objectInfo") }}</span>
            <span class="text-xs theme-status-warning-text font-normal">{{
              $t("toyEditor.toyStoryteller")
            }}</span>
          </h4>

          <!-- Content ID -->
          <div v-if="parsedToyId" class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
              $t("toyEditor.toyId")
            }}</label>
            <input
              v-model.number="contentId"
              type="number"
              required
              :disabled="!!parsedToyId"
              placeholder="Ex: 8001"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <!-- Name -->
          <div class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
              $t("toyEditor.productName")
            }}</label>
            <input
              v-model="mediaTitle"
              type="text"
              required
              placeholder="Ex: Lunii - Les Histoires de Suzanne et Gaston"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">
              {{ $t("toy.manufacturerLabel") }}
            </label>
            <input
              v-model="manufacturer"
              type="text"
              maxlength="300"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">
              {{ $t("toy.productLine") }}
            </label>
            <input
              v-model="productLine"
              type="text"
              maxlength="300"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">
              {{ $t("toy.releaseYear") }}
            </label>
            <input
              v-model="releaseYear"
              type="number"
              min="1800"
              max="2200"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">
              {{ $t("toy.coverImageLabel") }}
            </label>
            <input
              v-model="coverUrl"
              type="url"
              maxlength="2048"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">
              {{ $t("toy.description") }}
            </label>
            <textarea
              v-model="description"
              rows="4"
              maxlength="10000"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
            />
          </div>

          <!-- Language -->
          <div class="space-y-1">
            <label
              for="toy-project-dubbing-language"
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("common.language") }}</label
            >
            <AdminLanguageSelect
              id="toy-project-dubbing-language"
              v-model="dubbingLanguage"
              required
            />
          </div>

          <!-- Status -->
          <div class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
              $t("common.status")
            }}</label>
            <select
              v-model="status"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
            >
              <option value="validated">{{ $t("common.validated") }}</option>
              <option value="pending">
                {{ $t("common.pendingValidation") }}
              </option>
              <option value="draft">{{ $t("common.draft") }}</option>
            </select>
          </div>
        </div>

        <!-- Technical Crew Form (Right 2 Columns) -->
        <div
          class="lg:col-span-2 theme-surface-overlay border theme-border rounded-2xl p-6 space-y-6 shadow-xl"
        >
          <h4
            class="text-sm font-bold theme-text uppercase tracking-wider border-b theme-border pb-3 flex items-center justify-between"
          >
            <span>{{ $t("toyEditor.manufacturerStudio") }}</span>
            <span class="text-xs theme-text-muted">{{ $t("common.production") }}</span>
          </h4>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Studio / Manufacturer -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("toyEditor.studioManufacturer")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="selectedStudioId"
                :options="studioOptions"
                :loading="isSearchingStudios"
                placeholder="Rechercher (ex: Lunii, VTech, Tonies...)"
                :allow-create="true"
                :display-fn="getStudioName"
                @search="searchStudios"
                @create="
                  (q: string) => openCreateStudioDialog(q, (id: number) => (selectedStudioId = id))
                "
              />
            </div>

            <!-- Direction Artistique -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("toyEditor.artisticDirection")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="artisticDirectorId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Rechercher..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="
                  (q: string) => openCreateVaDialog(q, (id: number) => (artisticDirectorId = id))
                "
              />
            </div>

            <!-- Prise de son -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("toyEditor.recording")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="recordingId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Rechercher..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q: string) => openCreateVaDialog(q, (id: number) => (recordingId = id))"
              />
            </div>

            <!-- Mixage -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("toyEditor.mixing")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="mixingId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Rechercher..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q: string) => openCreateVaDialog(q, (id: number) => (mixingId = id))"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Cast Roster Section -->
      <div class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-6 shadow-xl">
        <div
          class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b theme-border pb-4"
        >
          <div>
            <h4 class="text-sm font-bold theme-text uppercase tracking-wider">
              {{ $t("toyEditor.voiceNarrators") }}
            </h4>
            <p class="text-xs theme-text-muted mt-0.5">
              {{ $t("toyEditor.associateActors") }}
            </p>
          </div>
          <button
            type="button"
            @click="addNewCastRow"
            class="px-4 py-2 theme-primary-bg hover:bg-[var(--app-color-primary-hover)] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>{{ $t("common.addVoice") }}</span>
          </button>
        </div>

        <div v-if="castList.length === 0" class="text-center py-8 theme-text-muted text-sm">
          {{ $t("common.noVoiceRecorded") }}
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="(row, index) in castList"
            :key="index"
            class="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 theme-input rounded-xl border theme-border items-end"
          >
            <!-- Voice Actor -->
            <div class="md:col-span-4 space-y-1">
              <label class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("common.actor")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="row.voice_actor_id"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Rechercher un comédien..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="
                  (q: string) => openCreateVaDialog(q, (id: number) => (row.voice_actor_id = id))
                "
              />
            </div>

            <!-- Role / Character Name -->
            <div class="md:col-span-2 space-y-1">
              <label class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("common.characterRole")
              }}</label>
              <input
                v-model="row.character_name"
                type="text"
                placeholder="Ex: Narrateur, Suzanne..."
                class="w-full px-3 py-2 theme-surface-overlay border theme-border rounded-xl theme-text text-xs theme-placeholder focus:outline-none focus:ring-1 focus:ring-[var(--app-color-focus)]"
              />
            </div>

            <div class="md:col-span-2 space-y-1">
              <label class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("projectEditor.castNote")
              }}</label>
              <input
                v-model="row.note"
                type="text"
                class="w-full px-3 py-2 theme-surface-overlay border theme-border rounded-xl theme-text text-xs theme-placeholder focus:outline-none focus:ring-1 focus:ring-[var(--app-color-focus)]"
              />
            </div>

            <!-- Performance Type -->
            <div class="md:col-span-3 space-y-1">
              <label class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("common.performanceType")
              }}</label>
              <input
                v-model="row.performance"
                type="text"
                placeholder="Ex: Narration, Voix chantée..."
                class="w-full px-3 py-2 theme-surface-overlay border theme-border rounded-xl theme-text text-xs theme-placeholder focus:outline-none focus:ring-1 focus:ring-[var(--app-color-focus)]"
              />
            </div>

            <!-- Remove Button -->
            <div class="md:col-span-1 flex justify-end">
              <button
                type="button"
                @click="removeCastRow(index)"
                class="p-2 theme-text-muted hover:text-[var(--app-color-danger-text)] transition-colors rounded-lg"
                title="Supprimer"
              >
                <Trash2Icon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div
        class="theme-surface-overlay p-6 rounded-2xl border theme-border flex justify-between items-center shadow-xl"
      >
        <button
          type="button"
          @click="router.back()"
          class="px-5 py-2.5 theme-surface-muted theme-hover-surface-muted theme-text-secondary text-xs font-semibold rounded-xl border theme-border transition-colors"
        >
          {{ $t("common.cancelButton") }}
        </button>

        <button
          type="submit"
          :disabled="isSaving"
          class="px-6 py-2.5 theme-primary-bg hover:bg-[var(--app-color-primary-hover)] disabled:opacity-50 text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2"
        >
          <Loader2Icon v-if="isSaving" class="w-4 h-4 animate-spin" />
          <span>{{ isEditMode ? "Enregistrer les modifications" : "Créer le projet" }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { validateDubbingLanguage, displayDubbingLanguage } from "@app/shared-logic";
import type { Toy, ToyMetadataInput } from "@app/shared-logic";
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Smile as SmileIcon, Loader2 as Loader2Icon, Trash2 as Trash2Icon } from "lucide-vue-next";
import {
  createDubbingProjectSaveClient,
  getEditableDubbingProjectStatus,
  getDubbingProjectSaveErrorMessage,
  type DubbingProjectCastSaveRow,
  type DubbingProjectSaveResponse,
  type WorkExpectedValues,
} from "~/utils/dubbing-project-save";
import { readSingleRouteParam, type DubbingProjectTab } from "~/utils/admin-project-editor-types";
import type { VoiceActorCreationPayload } from "~/composables/useMetadataCreation";

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const supabase = useSupabaseClient();
const saveDubbingProject = createDubbingProjectSaveClient((body) =>
  $fetch<DubbingProjectSaveResponse>("/api/save-dubbing-project", {
    method: "POST",
    body,
  }),
);
const saveToyMetadata = (body: {
  request_id: string;
  content_id: number;
  expected_updated_at: string | null;
  metadata: ToyMetadataInput;
}) =>
  $fetch<{ toy: { updated_at?: string }; auditLogId: string; replayed: boolean }>(
    "/api/save-toy-metadata",
    { method: "POST", body },
  );

const toyIdParam = computed(() => readSingleRouteParam(route.params.toyId) ?? "");
const projectIdParam = computed(() => readSingleRouteParam(route.params.projectId) ?? "");

const isEditMode = computed(() => projectIdParam.value && projectIdParam.value !== "new");

const parsedToyId = computed(() => {
  const num = parseInt(toyIdParam.value, 10);
  return isNaN(num) ? null : num;
});

const contentId = ref<number | null>(parsedToyId.value);
const mediaTitle = ref("");
const manufacturer = ref("");
const productLine = ref("");
const releaseYear = ref<number | string | null>(null);
const coverUrl = ref("");
const description = ref("");
const toyMetadataUpdatedAt = ref<string | null>(null);
const loadedToyMetadata = ref<ToyMetadataInput | null>(null);
const toyMetadataLoadFailed = ref(false);
const createdToy = ref<{
  contentId: number;
  projectId: number;
  projectUpdatedAt: string;
  metadataUpdatedAt: string;
  metadata: ToyMetadataInput;
} | null>(null);
const internalMediaRequestId = ref<string | null>(null);
const dubbingLanguage = ref("");
const status = ref<"validated" | "pending" | "draft">("validated");
const selectedStudioId = ref<number | null>(null);
const projectUpdatedAt = ref<string | null>(null);
const artisticDirectorId = ref<number | null>(null);
const recordingId = ref<number | null>(null);
const mixingId = ref<number | null>(null);

interface CastRow {
  id?: number;
  voice_actor_id: number | null;
  character_name: string;
  performance: string;
  note: string;
  expectedUpdatedAt?: string | null;
  expected?: WorkExpectedValues;
}

const castList = ref<CastRow[]>([]);
const toyDubbingProjects = ref<DubbingProjectTab[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);

const studioOptions = ref<{ id: number; name: string }[]>([]);
const isSearchingStudios = ref(false);
const voiceActorOptions = ref<{ id: number; name: string }[]>([]);
const isSearchingVoiceActors = ref(false);

function getStudioName(opt: { id: number; name: string }) {
  return opt?.name || "";
}

function getVoiceActorName(opt: { id: number; name: string }) {
  return opt?.name || "";
}

async function searchStudios(query: string) {
  if (!query) return;
  isSearchingStudios.value = true;
  try {
    const { data } = await supabase
      .from("studios")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .limit(10);
    studioOptions.value = data || [];
  } finally {
    isSearchingStudios.value = false;
  }
}

async function searchVoiceActors(query: string) {
  if (!query) return;
  isSearchingVoiceActors.value = true;
  try {
    const { data } = await supabase
      .from("voice_actors")
      .select("id, firstname, lastname")
      .or(`firstname.ilike.%${query}%,lastname.ilike.%${query}%`)
      .limit(15);
    voiceActorOptions.value = (data || []).map((v) => ({
      id: v.id,
      name: `${v.firstname} ${v.lastname}`.trim(),
    }));
  } finally {
    isSearchingVoiceActors.value = false;
  }
}

function openCreateStudioDialog(name: string, cb: (id: number) => void) {
  const newName = prompt("Nom du nouveau studio:", name);
  if (newName) {
    void (async () => {
      const { data } = await supabase
        .from("studios")
        .insert({ name: newName })
        .select("id, name")
        .single();
      if (data) {
        studioOptions.value.push(data);
        cb(data.id);
      }
    })();
  }
}

const pendingVaCreationRequests = new Map<string, string>();

function openCreateVaDialog(name: string, cb: (id: number) => void) {
  const parts = name.trim().split(/\s+/);
  const firstname = parts[0] || "";
  const providedLastname = parts.slice(1).join(" ") || prompt("Nom de famille du comédien :", "");
  if (!firstname || !providedLastname?.trim()) return;

  const payload: VoiceActorCreationPayload = {
    firstname,
    lastname: providedLastname.trim(),
    status: "active",
  };
  const payloadKey = JSON.stringify(payload);
  const requestId = pendingVaCreationRequests.get(payloadKey) ?? crypto.randomUUID();
  pendingVaCreationRequests.set(payloadKey, requestId);

  void (async () => {
    try {
      const { data } = await useMetadataCreation().createVoiceActor(payload, requestId);
      pendingVaCreationRequests.delete(payloadKey);
      const item = { id: data.id, name: `${data.firstname} ${data.lastname}` };
      voiceActorOptions.value.push(item);
      cb(data.id);
    } catch (error) {
      console.error("Failed to create voice actor:", error);
      alert("Impossible de créer le comédien. Veuillez réessayer.");
    }
  })();
}

function addNewCastRow() {
  castList.value.push({
    voice_actor_id: null,
    character_name: "Voix / Personnage",
    performance: "Narration",
    note: "",
  });
}

function removeCastRow(index: number) {
  castList.value.splice(index, 1);
}

function getDisplayLanguage(langCode?: string): string {
  return langCode ? displayDubbingLanguage(langCode, "fr") : "";
}

onMounted(async () => {
  try {
    if (parsedToyId.value) {
      try {
        const response = await $fetch<{ toy: Toy | null }>(
          `/api/toy-metadata/${parsedToyId.value}`,
        );
        if (response.toy) {
          mediaTitle.value = response.toy.name;
          manufacturer.value = response.toy.manufacturer || "";
          productLine.value = response.toy.product_line || "";
          releaseYear.value = response.toy.release_year ?? null;
          coverUrl.value = response.toy.cover_url || "";
          description.value = response.toy.description || "";
          toyMetadataUpdatedAt.value = response.toy.updated_at || null;
          loadedToyMetadata.value = readToyMetadataForm();
        }
      } catch (err) {
        toyMetadataLoadFailed.value = true;
        console.error("Error loading toy metadata:", err);
      }

      const { data: projects } = await supabase
        .from("dubbing_projects")
        .select("*, studios(id, name)")
        .eq("content_id", parsedToyId.value)
        .eq("content_type", "toy");

      toyDubbingProjects.value = projects || [];
    }

    if (isEditMode.value) {
      const projectId = Number(projectIdParam.value);
      const { data: project } = await supabase
        .from("dubbing_projects")
        .select(
          "*, studios(id, name), work(*, voice_actors(id, firstname, lastname, profile_picture))",
        )
        .eq("id", projectId)
        .single();

      if (project) {
        dubbingLanguage.value = project.language || "";
        status.value = getEditableDubbingProjectStatus(project.status);
        selectedStudioId.value = project.studio_id;
        projectUpdatedAt.value = project.updated_at;
        if (project.studios) {
          studioOptions.value = [project.studios];
        }

        const { data: crew } = await supabase
          .from("dubbing_project_crew")
          .select("*, voice_actors(id, firstname, lastname), jobs(name)")
          .eq("dubbing_project_id", projectId);

        if (crew) {
          for (const member of crew) {
            const va = member.voice_actors;
            if (va) {
              voiceActorOptions.value.push({
                id: va.id,
                name: `${va.firstname} ${va.lastname}`,
              });
            }
            if (member.job_id === 1) artisticDirectorId.value = member.person_id;
            if (member.job_id === 3) recordingId.value = member.person_id;
            if (member.job_id === 5) mixingId.value = member.person_id;
          }
        }

        if (project.work) {
          castList.value = project.work.map((w) => {
            if (w.voice_actors) {
              voiceActorOptions.value.push({
                id: w.voice_actors.id,
                name: `${w.voice_actors.firstname} ${w.voice_actors.lastname}`,
              });
            }
            return {
              id: w.id,
              voice_actor_id: w.voice_actor_id,
              character_name: w.character_name || "Voix",
              performance: w.performance || "",
              note: w.note || "",
              expectedUpdatedAt: w.updated_at,
              expected: {
                actor_id: w.actor_id,
                character_id: w.character_id,
                character_name: w.character_name,
                voice_actor_id: w.voice_actor_id,
                performance: w.performance,
                note: w.note,
                highlight: w.highlight,
                status: w.status,
              },
            };
          });
        }
      }
    }
  } catch (err) {
    console.error("Error loading toy project:", err);
  } finally {
    isLoading.value = false;
  }
});

async function saveToyProject() {
  if (parsedToyId.value !== null && (contentId.value === null || contentId.value === 0)) return;
  isSaving.value = true;

  try {
    let savedContentId = contentId.value;
    let currentProjectId = isEditMode.value ? Number(projectIdParam.value) : null;
    let expectedProjectUpdatedAt = projectUpdatedAt.value;
    const metadata = readToyMetadataForm();

    if (parsedToyId.value === null) {
      if (!createdToy.value) {
        internalMediaRequestId.value ||= crypto.randomUUID();
        const response = await $fetch<{
          media: { id: number };
          project: { id: number; updated_at: string; metadata_updated_at: string | null };
        }>("/api/internal-media-create", {
          method: "POST",
          body: {
            request_id: internalMediaRequestId.value,
            media_type: "toy",
            name: metadata.name,
            brand: metadata.manufacturer,
            manufacturer: metadata.manufacturer,
            product_line: metadata.product_line,
            release_year: metadata.release_year,
            cover_url: metadata.cover_url,
            description: metadata.description,
            dubbing_language: validateDubbingLanguage(dubbingLanguage.value),
          },
        });
        if (!response.project.metadata_updated_at) {
          throw new Error("Toy metadata was not returned after creation.");
        }
        createdToy.value = {
          contentId: response.media.id,
          projectId: response.project.id,
          projectUpdatedAt: response.project.updated_at,
          metadataUpdatedAt: response.project.metadata_updated_at,
          metadata,
        };
      } else if (JSON.stringify(metadata) !== JSON.stringify(createdToy.value.metadata)) {
        const savedMetadata = await saveToyMetadata({
          request_id: crypto.randomUUID(),
          content_id: createdToy.value.contentId,
          expected_updated_at: createdToy.value.metadataUpdatedAt,
          metadata,
        });
        createdToy.value.metadataUpdatedAt =
          savedMetadata.toy.updated_at || createdToy.value.metadataUpdatedAt;
        createdToy.value.metadata = metadata;
      }

      savedContentId = createdToy.value.contentId;
      contentId.value = savedContentId;
      currentProjectId = createdToy.value.projectId;
      expectedProjectUpdatedAt = createdToy.value.projectUpdatedAt;
      toyMetadataUpdatedAt.value = createdToy.value.metadataUpdatedAt;
      loadedToyMetadata.value = createdToy.value.metadata;
    } else {
      if (toyMetadataLoadFailed.value) {
        throw new Error("Reload this toy metadata before saving.");
      }
      if (JSON.stringify(metadata) !== JSON.stringify(loadedToyMetadata.value)) {
        const savedMetadata = await saveToyMetadata({
          request_id: crypto.randomUUID(),
          content_id: parsedToyId.value,
          expected_updated_at: toyMetadataUpdatedAt.value,
          metadata,
        });
        toyMetadataUpdatedAt.value = savedMetadata.toy.updated_at || null;
        loadedToyMetadata.value = metadata;
      }
      savedContentId = parsedToyId.value;
    }

    if (savedContentId === null || savedContentId === 0) {
      throw new Error("A toy content id is required.");
    }

    const crew: Array<{ job_id: number; person_id: number }> = [];
    if (artisticDirectorId.value !== null)
      crew.push({ job_id: 1, person_id: artisticDirectorId.value });
    if (recordingId.value !== null) crew.push({ job_id: 3, person_id: recordingId.value });
    if (mixingId.value !== null) crew.push({ job_id: 5, person_id: mixingId.value });

    const cast: DubbingProjectCastSaveRow[] = castList.value.flatMap((row) => {
      if (!row.voice_actor_id) return [];
      if (
        row.id !== undefined &&
        (row.expected === undefined || row.expectedUpdatedAt === undefined)
      ) {
        throw new Error("Reload this project before saving its cast.");
      }
      return [
        {
          ...(row.id === undefined
            ? {}
            : {
                id: row.id,
                expected_updated_at: row.expectedUpdatedAt,
                expected: row.expected,
              }),
          voice_actor_id: row.voice_actor_id,
          character_name: row.character_name,
          performance: row.performance,
          note: row.note || null,
        },
      ];
    });

    const result = await saveDubbingProject({
      project_id: currentProjectId,
      expected_updated_at: currentProjectId === null ? null : expectedProjectUpdatedAt,
      project: {
        content_id: savedContentId,
        content_type: "toy",
        language: validateDubbingLanguage(dubbingLanguage.value),
        status: status.value,
        studio_id: selectedStudioId.value,
      },
      crew,
      cast,
    });
    projectUpdatedAt.value = result.updatedAt;

    router.push(localePath(`/toy/${savedContentId}`));
  } catch (err) {
    console.error("Failed to save toy project:", err);
    alert(getDubbingProjectSaveErrorMessage(err));
  } finally {
    isSaving.value = false;
  }
}

function readToyMetadataForm(): ToyMetadataInput {
  const rawReleaseYear = releaseYear.value;
  const parsedReleaseYear =
    rawReleaseYear === null || rawReleaseYear === "" ? null : Number(rawReleaseYear);
  if (
    parsedReleaseYear !== null &&
    (!Number.isSafeInteger(parsedReleaseYear) ||
      parsedReleaseYear < 1800 ||
      parsedReleaseYear > 2200)
  ) {
    throw new Error("Release year must be between 1800 and 2200.");
  }

  return {
    name: mediaTitle.value.trim(),
    manufacturer: manufacturer.value.trim() || null,
    product_line: productLine.value.trim() || null,
    release_year: parsedReleaseYear,
    cover_url: coverUrl.value.trim() || null,
    description: description.value.trim() || null,
  };
}
</script>
