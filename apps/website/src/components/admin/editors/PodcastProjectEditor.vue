<template>
  <div class="admin-project-editor max-w-6xl mx-auto space-y-6">
    <!-- Header -->
    <div
      class="theme-surface-overlay p-6 rounded-2xl border theme-border flex justify-between items-center shadow-xl"
    >
      <div>
        <h3 class="text-xl font-bold theme-text flex items-center gap-2">
          <RadioIcon class="w-6 h-6 theme-status-info-text" />
          {{
            isEditMode
              ? "Modifier le projet de podcast / fiction audio"
              : "Créer un projet de podcast / fiction audio"
          }}
        </h3>
        <p class="text-sm theme-text-muted mt-1">
          {{
            isEditMode
              ? `Mise à jour du projet #${projectIdParam}`
              : "Informations podcast, studio, réalisation et casting vocal."
          }}
        </p>
      </div>
      <NuxtLink
        :to="
          parsedPodcastId
            ? localePath(`/podcast/${parsedPodcastId}`)
            : localePath('/')
        "
        class="text-xs font-semibold px-4 py-2.5 theme-surface-muted theme-hover-surface-muted theme-text-secondary theme-hover-text rounded-xl border theme-border transition-colors flex items-center space-x-2"
      >
        <span>{{ parsedPodcastId ? "← Retour au podcast" : "← Accueil" }}</span>
      </NuxtLink>
    </div>

    <!-- Navigation Tabs -->
    <div
      v-if="parsedPodcastId"
      class="flex flex-wrap gap-2 pb-2 border-b theme-border"
    >
      <NuxtLink
        v-for="project in podcastDubbingProjects"
        :key="project.id"
        :to="
          localePath(`/podcast/${parsedPodcastId}/projects/${project.id}/edit`)
        "
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
        :to="localePath(`/podcast/${parsedPodcastId}/projects/new`)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-dashed"
        :class="
          projectIdParam === 'new'
            ? 'theme-status-info theme-status-info-text border'
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
      <Loader2Icon class="w-8 h-8 animate-spin theme-status-info-text" />
      <span class="text-sm">{{ $t("common.loadingProjectData") }}</span>
    </div>

    <form v-else @submit.prevent="savePodcastProject" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Media Metadata Card (Left Column) -->
        <div
          class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-5 h-fit shadow-xl"
        >
          <h4
            class="text-sm font-bold theme-text uppercase tracking-wider border-b theme-border pb-3 flex items-center justify-between"
          >
            <span>{{ $t("podcastEditor.podcastInfo") }}</span>
            <span class="text-xs theme-status-info-text font-normal">{{
              $t("podcastEditor.itunesRss")
            }}</span>
          </h4>

          <!-- Cover Preview -->
          <div class="flex justify-center">
            <div
              class="relative h-48 w-48 rounded-xl overflow-hidden border theme-border theme-input flex items-center justify-center theme-text-muted shadow-md"
            >
              <NuxtImg
                format="webp"
                v-if="posterUrl"
                :src="posterUrl"
                class="h-full w-full object-cover"
                alt="Cover"
              />
              <div v-else class="text-center p-3 theme-text-secondary">
                <RadioIcon class="h-10 w-10 mx-auto mb-1 opacity-50" />
                <span class="text-[10px]">{{
                  $t("podcastEditor.noThumbnail")
                }}</span>
              </div>
            </div>
          </div>

          <!-- Content ID / iTunes ID -->
          <div class="space-y-1">
            <label
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("podcastEditor.itunesCollectionId") }}</label
            >
            <div class="flex space-x-2">
              <input
                v-model.number="contentId"
                type="number"
                required
                :disabled="!!parsedPodcastId"
                placeholder="Ex: 1478201201"
                class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                @click="fetchPodcastMetadata"
                :disabled="isFetchingMetadata || !contentId"
                class="px-3 py-2 theme-surface-muted theme-hover-surface-muted disabled:opacity-50 theme-text text-xs font-semibold rounded-xl border theme-border whitespace-nowrap"
              >
                <Loader2Icon
                  v-if="isFetchingMetadata"
                  class="w-4 h-4 animate-spin"
                />
                <span v-else>{{ $t("common.fetch") }}</span>
              </button>
            </div>
          </div>

          <!-- Title -->
          <div class="space-y-1">
            <label
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("podcastEditor.podcastTitle") }}</label
            >
            <input
              v-model="mediaTitle"
              type="text"
              required
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
            />
          </div>

          <!-- Language -->
          <div class="space-y-1">
            <label
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("common.language") }}</label
            >
            <AdminLanguageSelect v-model="language" required />
          </div>

          <!-- Status -->
          <div class="space-y-1">
            <label
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("common.status") }}</label
            >
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
            <span>{{ $t("podcastEditor.technicalStudio") }}</span>
            <span class="text-xs theme-text-muted">{{
              $t("podcastEditor.soundProduction")
            }}</span>
          </h4>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Studio -->
            <div class="space-y-1">
              <label
                class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("podcastEditor.studioProducer") }}</label
              >
              <AdminAsyncAutocomplete
                v-model="selectedStudioId"
                :options="studioOptions"
                :loading="isSearchingStudios"
                placeholder="Rechercher un studio (ex: Binge Audio, Radio France...)"
                :allow-create="true"
                :display-fn="getStudioName"
                @search="searchStudios"
                @create="
                  (q: string) =>
                    openCreateStudioDialog(
                      q,
                      (id: number) => (selectedStudioId = id),
                    )
                "
              />
            </div>

            <!-- Direction Artistique -->
            <div class="space-y-1">
              <label
                class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("podcastEditor.directionArtistic") }}</label
              >
              <AdminAsyncAutocomplete
                v-model="artisticDirectorId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Rechercher un réalisateur/D.A..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="
                  (q: string) =>
                    openCreateVaDialog(
                      q,
                      (id: number) => (artisticDirectorId = id),
                    )
                "
              />
            </div>

            <!-- Prise de son -->
            <div class="space-y-1">
              <label
                class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("podcastEditor.recordingSoundDesigner") }}</label
              >
              <AdminAsyncAutocomplete
                v-model="recordingId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Rechercher..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="
                  (q: string) =>
                    openCreateVaDialog(q, (id: number) => (recordingId = id))
                "
              />
            </div>

            <!-- Mixage -->
            <div class="space-y-1">
              <label
                class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("podcastEditor.mixingAudio") }}</label
              >
              <AdminAsyncAutocomplete
                v-model="mixingId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Rechercher..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="
                  (q: string) =>
                    openCreateVaDialog(q, (id: number) => (mixingId = id))
                "
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Cast Roster Section -->
      <div
        class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-6 shadow-xl"
      >
        <div
          class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b theme-border pb-4"
        >
          <div>
            <h4 class="text-sm font-bold theme-text uppercase tracking-wider">
              {{ $t("podcastEditor.voiceDistribution") }}
            </h4>
            <p class="text-xs theme-text-muted mt-0.5">
              {{ $t("podcastEditor.associateActors") }}
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

        <div
          v-if="castList.length === 0"
          class="text-center py-8 theme-text-muted text-sm"
        >
          {{ $t("podcastEditor.noRoleRecorded") }}
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="(row, index) in castList"
            :key="index"
            class="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 theme-input rounded-xl border theme-border items-end"
          >
            <!-- Voice Actor -->
            <div class="md:col-span-4 space-y-1">
              <label
                class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("common.actor") }}</label
              >
              <AdminAsyncAutocomplete
                v-model="row.voice_actor_id"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Rechercher un comédien..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="
                  (q: string) =>
                    openCreateVaDialog(
                      q,
                      (id: number) => (row.voice_actor_id = id),
                    )
                "
              />
            </div>

            <!-- Role / Character Name -->
            <div class="md:col-span-2 space-y-1">
              <label
                class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("common.characterRole") }}</label
              >
              <input
                v-model="row.character_name"
                type="text"
                placeholder="Ex: Protagoniste, Narrateur..."
                class="w-full px-3 py-2 theme-surface-overlay border theme-border rounded-xl theme-text text-xs theme-placeholder focus:outline-none focus:ring-1 focus:ring-[var(--app-color-focus)]"
              />
            </div>

            <div class="md:col-span-2 space-y-1">
              <label
                class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("projectEditor.castNote") }}</label
              >
              <input
                v-model="row.note"
                type="text"
                class="w-full px-3 py-2 theme-surface-overlay border theme-border rounded-xl theme-text text-xs theme-placeholder focus:outline-none focus:ring-1 focus:ring-[var(--app-color-focus)]"
              />
            </div>

            <!-- Performance Type -->
            <div class="md:col-span-3 space-y-1">
              <label
                class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("common.performanceType") }}</label
              >
              <input
                v-model="row.performance"
                type="text"
                placeholder="Ex: Voix principale, Invité..."
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
          <span>{{
            isEditMode ? "Enregistrer les modifications" : "Créer le projet"
          }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Radio as RadioIcon,
  Loader2 as Loader2Icon,
  Trash2 as Trash2Icon,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const supabase = useSupabaseClient();

const podcastIdParam = computed(() => route.params.podcastId as string);
const projectIdParam = computed(() => route.params.projectId as string);

const isEditMode = computed(
  () => projectIdParam.value && projectIdParam.value !== "new",
);

const parsedPodcastId = computed(() => {
  const num = parseInt(podcastIdParam.value, 10);
  return isNaN(num) ? null : num;
});

const contentId = ref<number | null>(parsedPodcastId.value);
const mediaTitle = ref("");
const posterUrl = ref<string | null>(null);
const language = ref("fr");
const status = ref("validated");
const selectedStudioId = ref<number | null>(null);
const artisticDirectorId = ref<number | null>(null);
const recordingId = ref<number | null>(null);
const mixingId = ref<number | null>(null);

interface CastRow {
  id?: number;
  voice_actor_id: number | null;
  character_name: string;
  performance: string;
  note: string;
}

const castList = ref<CastRow[]>([]);
const podcastDubbingProjects = ref<any[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const isFetchingMetadata = ref(false);

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
    studioOptions.value = (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
    }));
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
    voiceActorOptions.value = (data || []).map((v: any) => ({
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

function openCreateVaDialog(name: string, cb: (id: number) => void) {
  const parts = name.split(" ");
  const firstname = parts[0] || "";
  const lastname = parts.slice(1).join(" ") || "";
  void (async () => {
    const { data } = await supabase
      .from("voice_actors")
      .insert({
        firstname,
        lastname,
        status: "active",
      })
      .select("id, firstname, lastname")
      .single();
    if (data) {
      const item = { id: data.id, name: `${data.firstname} ${data.lastname}` };
      voiceActorOptions.value.push(item);
      cb(data.id);
    }
  })();
}

function addNewCastRow() {
  castList.value.push({
    voice_actor_id: null,
    character_name: "Voix",
    performance: "Rôle",
    note: "",
  });
}

function removeCastRow(index: number) {
  castList.value.splice(index, 1);
}

function getDisplayLanguage(langCode?: string): string {
  if (langCode === "fr" || langCode === "fr-FR") return "Français";
  if (langCode === "en" || langCode === "en-US") return "Anglais";
  return langCode || "Autre";
}

async function fetchPodcastMetadata() {
  if (!contentId.value) return;
  isFetchingMetadata.value = true;
  try {
    const data = await $fetch<any>(`/api/podcast/${contentId.value}`);
    if (data?.podcast) {
      mediaTitle.value = data.podcast.title;
      posterUrl.value = data.podcast.cover_url || null;
    }
  } catch (err) {
    console.error("Failed to fetch podcast metadata:", err);
  } finally {
    isFetchingMetadata.value = false;
  }
}

onMounted(async () => {
  try {
    if (parsedPodcastId.value) {
      await fetchPodcastMetadata();

      const { data: projects } = await supabase
        .from("dubbing_projects")
        .select("*, studios(id, name)")
        .eq("content_id", parsedPodcastId.value)
        .eq("content_type", "podcast");

      podcastDubbingProjects.value = projects || [];
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
        language.value = project.language || "fr";
        status.value = project.status || "validated";
        selectedStudioId.value = project.studio_id;
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
            if (member.job_id === 1)
              artisticDirectorId.value = member.person_id;
            if (member.job_id === 3) recordingId.value = member.person_id;
            if (member.job_id === 5) mixingId.value = member.person_id;
          }
        }

        if (project.work) {
          castList.value = project.work.map((w: any) => {
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
            };
          });
        }
      }
    }
  } catch (err) {
    console.error("Error loading podcast project:", err);
  } finally {
    isLoading.value = false;
  }
});

async function savePodcastProject() {
  if (!contentId.value) return;
  isSaving.value = true;

  try {
    let currentProjectId: number;

    if (isEditMode.value) {
      currentProjectId = Number(projectIdParam.value);
      await supabase
        .from("dubbing_projects")
        .update({
          language: language.value,
          status: status.value,
          studio_id: selectedStudioId.value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentProjectId);
    } else {
      const { data: newProject, error } = await supabase
        .from("dubbing_projects")
        .insert({
          content_id: contentId.value,
          content_type: "podcast",
          language: language.value,
          status: status.value,
          studio_id: selectedStudioId.value,
        })
        .select("id")
        .single();

      if (error || !newProject)
        throw error || new Error("Failed to create project");
      currentProjectId = newProject.id;
    }

    // Save technical crew
    await supabase
      .from("dubbing_project_crew")
      .delete()
      .eq("dubbing_project_id", currentProjectId);

    const crewInserts: any[] = [];
    if (artisticDirectorId.value) {
      crewInserts.push({
        dubbing_project_id: currentProjectId,
        person_id: artisticDirectorId.value,
        job_id: 1, // D.A.
      });
    }
    if (recordingId.value) {
      crewInserts.push({
        dubbing_project_id: currentProjectId,
        person_id: recordingId.value,
        job_id: 3, // Enregistrement
      });
    }
    if (mixingId.value) {
      crewInserts.push({
        dubbing_project_id: currentProjectId,
        person_id: mixingId.value,
        job_id: 5, // Mixage
      });
    }
    if (crewInserts.length > 0) {
      await supabase.from("dubbing_project_crew").insert(crewInserts);
    }

    // Save works / cast
    for (const cast of castList.value) {
      if (!cast.voice_actor_id) continue;
      if (cast.id) {
        await supabase
          .from("work")
          .update({
            voice_actor_id: cast.voice_actor_id,
            character_name: cast.character_name,
            performance: cast.performance,
            note: cast.note || null,
            status: "validated",
            updated_at: new Date().toISOString(),
          })
          .eq("id", cast.id);
      } else {
        await supabase.from("work").insert({
          dubbing_project_id: currentProjectId,
          voice_actor_id: cast.voice_actor_id,
          character_name: cast.character_name,
          performance: cast.performance,
          note: cast.note || null,
          status: "validated",
        });
      }
    }

    router.push(localePath(`/podcast/${contentId.value}`));
  } catch (err) {
    console.error("Failed to save podcast project:", err);
    alert("Erreur lors de l'enregistrement.");
  } finally {
    isSaving.value = false;
  }
}
</script>
