<template>
  <div
    class="admin-project-editor max-w-6xl mx-auto space-y-6"
    :inert="isSaving"
    :aria-busy="isSaving"
  >
    <!-- Header -->
    <div
      class="theme-surface-overlay p-6 rounded-2xl border theme-border flex justify-between items-center shadow-xl"
    >
      <div>
        <h3 class="text-xl font-bold theme-text flex items-center gap-2">
          <Gamepad2Icon class="w-6 h-6 theme-status-info-text" />
          {{
            isEditMode ? $t("projectEditor.editGameProject") : $t("projectEditor.createGameProject")
          }}
        </h3>
        <p class="text-sm theme-text-muted mt-1">
          {{
            isEditMode
              ? `Updating dubbing project ID #${projectIdParam}`
              : $t("projectEditor.fillInfoGame")
          }}
        </p>
      </div>
      <NuxtLink
        :to="igdbGameId ? localePath(`/game/${igdbGameId}`) : localePath('/')"
        class="text-xs font-semibold px-4 py-2.5 theme-surface-muted theme-hover-surface-muted theme-text-secondary theme-hover-text rounded-xl border theme-border transition-colors flex items-center space-x-2"
      >
        <span>{{
          igdbGameId ? $t("projectEditor.backToGame") : $t("projectEditor.backHome")
        }}</span>
      </NuxtLink>
    </div>

    <!-- Navigation Tabs -->
    <div v-if="igdbGameId" class="flex flex-wrap gap-2 pb-2 border-b theme-border">
      <NuxtLink
        v-for="project in gameDubbingProjects"
        :key="project.id"
        :to="localePath(`/game/${igdbGameId}/projects/${project.id}/edit`)"
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
        :to="localePath(`/game/${igdbGameId}/projects/new`)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-dashed"
        :class="
          projectIdParam === 'new'
            ? 'theme-status-info theme-status-info-text border'
            : 'theme-surface-overlay theme-text-muted theme-border theme-hover-surface-muted theme-hover-text'
        "
        >{{ $t("projectEditor.addLanguage") }}</NuxtLink
      >
    </div>

    <!-- Main Workspace -->
    <!-- Loading overlay -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center py-24 gap-4 theme-text-muted"
    >
      <Loader2Icon class="w-8 h-8 animate-spin theme-status-info-text" />
      <span class="text-sm">{{ $t("projectEditor.loadingData") }}</span>
    </div>

    <div
      v-else-if="loadError"
      role="alert"
      class="rounded-xl border border-[var(--app-color-danger-border)] theme-status-danger p-6 text-sm theme-status-danger-text"
    >
      {{ loadError }}
    </div>

    <form v-else @submit.prevent="saveGameProject" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Media Metadata Card (Left Column) -->
        <div
          class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-5 h-fit shadow-xl"
        >
          <h4
            class="text-sm font-bold theme-text uppercase tracking-wider border-b theme-border pb-3 flex items-center justify-between"
          >
            <span>{{ $t("admin.movieEditor.mediaInfo") }}</span>
            <span class="text-xs theme-status-info-text font-normal">{{
              $t("projectEditor.igdbLinked")
            }}</span>
          </h4>

          <!-- Poster Preview -->
          <div class="flex justify-center">
            <div
              class="relative h-48 w-32 rounded-xl overflow-hidden border theme-border theme-input flex items-center justify-center theme-text-muted shadow-md"
            >
              <NuxtImg
                format="webp"
                v-if="posterUrl"
                :src="posterUrl"
                class="h-full w-full object-cover"
                alt="Poster"
              />
              <div v-else class="text-center p-3 theme-text-secondary">
                <ImageIcon class="h-10 w-10 mx-auto mb-1 opacity-50" />
                <span class="text-[10px]">{{ $t("projectEditor.noPoster") }}</span>
              </div>
            </div>
          </div>

          <!-- Content ID / IGDB ID -->
          <div class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
              $t("projectEditor.igdbGameId")
            }}</label>
            <div class="flex space-x-2">
              <input
                v-model.number="contentId"
                type="number"
                required
                :disabled="!!igdbGameId"
                placeholder="e.g. 1020"
                class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <!-- Media Name / Title -->
          <div class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
              $t("admin.movieEditor.mediaTitle")
            }}</label>
            <input
              v-model="mediaTitle"
              type="text"
              required
              readonly
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm opacity-50 cursor-not-allowed"
            />
          </div>

          <!-- Language -->
          <div class="space-y-1">
            <label
              for="game-project-dubbing-language"
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("projectEditor.dubbingLanguage") }}</label
            >
            <AdminLanguageSelect
              id="game-project-dubbing-language"
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
              <option value="validated">
                {{ $t("admin.movieEditor.validated") }}
              </option>
              <option value="pending">
                {{ $t("admin.movieEditor.pending") }}
              </option>
              <option value="draft">{{ $t("admin.movieEditor.draft") }}</option>
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
            <span>{{ $t("admin.movieEditor.technicalDubbingTeam") }}</span>
            <span class="text-xs theme-text-muted">{{
              $t("admin.movieEditor.crewAttributes")
            }}</span>
          </h4>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Studio -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("details.dubbingStudio")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="selectedStudioId"
                :options="studioOptions"
                :loading="isSearchingStudios"
                placeholder="Search studio..."
                :allow-create="true"
                :display-fn="getStudioName"
                @search="searchStudios"
                @create="
                  (q: string) => openCreateStudioDialog(q, (id: number) => (selectedStudioId = id))
                "
              />
            </div>

            <!-- Artistic Director -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("admin.movieEditor.artisticDirector")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="artisticDirectorId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="
                  (q: string) => openCreateVaDialog(q, (id: number) => (artisticDirectorId = id))
                "
              />
            </div>

            <!-- Adaptation -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("admin.movieEditor.adaptation")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="adaptationId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q: string) => openCreateVaDialog(q, (id: number) => (adaptationId = id))"
              />
            </div>

            <!-- Recording -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("admin.movieEditor.soundRecording")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="recordingId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q: string) => openCreateVaDialog(q, (id: number) => (recordingId = id))"
              />
            </div>

            <!-- Editing -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("admin.movieEditor.soundEditing")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="editingId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q: string) => openCreateVaDialog(q, (id: number) => (editingId = id))"
              />
            </div>

            <!-- Mixing -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("dubbing.mixing")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="mixingId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q: string) => openCreateVaDialog(q, (id: number) => (mixingId = id))"
              />
            </div>

            <!-- Project Manager -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("admin.movieEditor.projectManager")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="projectManagerId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="
                  (q: string) => openCreateVaDialog(q, (id: number) => (projectManagerId = id))
                "
              />
            </div>

            <!-- Creative Supervision -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("admin.movieEditor.creativeSupervision")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="creativeSupervisionId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="
                  (q: string) => openCreateVaDialog(q, (id: number) => (creativeSupervisionId = id))
                "
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Cast / Voice Actors List -->
      <div class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-6 shadow-xl">
        <div class="flex justify-between items-center border-b theme-border pb-3">
          <h4 class="text-sm font-bold theme-text uppercase tracking-wider">
            {{ $t("projectEditor.voiceCast") }}
          </h4>
          <button
            type="button"
            @click="addCastRow"
            class="px-4 py-2 theme-primary-bg hover:bg-[var(--app-color-primary-hover)] text-xs font-semibold rounded-xl flex items-center transition-colors"
          >
            {{ $t("projectEditor.addVoiceActor") }}
          </button>
        </div>

        <div class="space-y-4">
          <div
            v-for="(row, index) in castRows"
            :key="index"
            class="p-4 theme-input border theme-border rounded-xl relative group"
          >
            <button
              type="button"
              @click="removeCastRow(index)"
              class="absolute -top-3 -right-3 theme-status-danger hover:bg-[var(--app-color-danger-bg)] border p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100 shadow-lg z-10"
              title="Remove row"
            >
              <XIcon class="w-4 h-4" />
            </button>

            <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
              <!-- Character fields -->
              <div class="md:col-span-12 space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("projectEditor.character")
                }}</label>
                <AdminAsyncAutocomplete
                  v-model="row.character_ref"
                  @update:model-value="
                    (val: string | number | null) => handleCharacterSelect(row, val)
                  "
                  :options="filteredIgdbCharacters"
                  :loading="isFetchingIgdb"
                  placeholder="Search Game Character..."
                  :allow-create="true"
                  :display-fn="
                    (id: string | number | null) => getCharacterName(id) || row.character_name
                  "
                  @search="(query: string) => searchCharacters(row, query)"
                  @create="(query: string) => handleCharacterCreate(row, query)"
                />
                <button
                  type="button"
                  class="text-xs theme-text-muted underline-offset-2 hover:underline"
                  @click="handleCharacterFreeText(row)"
                >
                  Use free-text role
                </button>
                <p
                  v-if="characterCatalogStatus === 'unavailable'"
                  role="status"
                  class="text-xs theme-status-warning-text"
                >
                  IGDB characters are unavailable. Local game characters remain available.
                </p>
                <p
                  v-else-if="providerCharacterCount === 0"
                  role="status"
                  class="text-xs theme-text-muted"
                >
                  IGDB returned no characters for this game. You can add a local character.
                </p>
                <div
                  v-if="getLocalCharacter(row)"
                  class="mt-2 space-y-2 rounded-lg border theme-border theme-surface-muted p-3"
                >
                  <div
                    v-for="candidate in getIgdbCandidates(row)"
                    :key="candidate.id"
                    class="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span class="theme-text-secondary">
                      Possible IGDB match: {{ candidate.name }}
                    </span>
                    <button
                      type="button"
                      class="theme-status-info-text underline-offset-2 hover:underline disabled:opacity-50"
                      :disabled="isUpdatingCharacterReferences"
                      @click="
                        updateGameCharacterReferences(row, {
                          igdb_character_id: candidate.igdb_character_id,
                        })
                      "
                    >
                      Confirm link
                    </button>
                  </div>
                  <div class="flex flex-wrap items-end gap-2">
                    <label class="min-w-48 flex-1 text-xs theme-text-secondary">
                      Wikidata QID
                      <input
                        :value="getWikidataDraft(row)"
                        type="text"
                        inputmode="text"
                        placeholder="Q12345"
                        class="mt-1 w-full rounded-lg border theme-border theme-input px-2 py-1.5"
                        @input="setWikidataDraft(row, $event)"
                      />
                    </label>
                    <button
                      type="button"
                      class="theme-status-info-text underline-offset-2 hover:underline disabled:opacity-50"
                      :disabled="isUpdatingCharacterReferences"
                      @click="saveWikidataReference(row)"
                    >
                      Save QID
                    </button>
                    <button
                      v-if="getLocalCharacter(row)?.igdb_character_id"
                      type="button"
                      class="theme-status-danger-text underline-offset-2 hover:underline disabled:opacity-50"
                      :disabled="isUpdatingCharacterReferences"
                      @click="
                        updateGameCharacterReferences(row, {
                          igdb_character_id: null,
                        })
                      "
                    >
                      Unlink IGDB
                    </button>
                  </div>
                </div>
              </div>

              <!-- Voice Actor -->
              <div class="md:col-span-8 space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("projectEditor.voiceActor")
                }}</label>
                <AdminAsyncAutocomplete
                  v-model="row.voice_actor_id"
                  :options="voiceActorOptions"
                  :loading="isSearchingVoiceActors"
                  placeholder="Search Voice Actor..."
                  :allow-create="true"
                  :display-fn="getVoiceActorName"
                  @search="searchVoiceActors"
                  @create="
                    (q: string) => openCreateVaDialog(q, (id: number) => (row.voice_actor_id = id))
                  "
                />
              </div>

              <!-- Performance -->
              <div class="md:col-span-4 space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("projectEditor.performanceType")
                }}</label>
                <select
                  v-model="row.performance"
                  class="w-full px-4 py-2 theme-surface-overlay border theme-border rounded-lg theme-text focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
                >
                  <option value="dialogues">
                    {{ $t("admin.movieEditor.dialogues") }}
                  </option>
                  <option value="dialogues & chant">
                    {{ $t("admin.movieEditor.dialoguesAndChant") }}
                  </option>
                  <option value="chant">
                    {{ $t("admin.movieEditor.chant") }}
                  </option>
                  <option value="bruitages">
                    {{ $t("projectEditor.performanceBruitages") }}
                  </option>
                  <option value="narration">
                    {{ $t("projectEditor.performanceNarration") }}
                  </option>
                </select>
              </div>

              <div class="md:col-span-4 space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("projectEditor.castNote")
                }}</label>
                <input
                  v-model="row.note"
                  type="text"
                  class="w-full px-4 py-2 theme-surface-overlay border theme-border rounded-lg theme-text focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
                />
              </div>

              <div class="md:col-span-12 flex items-center space-x-2">
                <input
                  type="checkbox"
                  v-model="row.highlight"
                  class="w-4 h-4 theme-surface-overlay theme-border rounded text-blue-500 focus:ring-[var(--app-color-focus)]"
                />
                <label class="text-xs theme-text-secondary">{{
                  $t("projectEditor.highlightCharacter")
                }}</label>
              </div>
            </div>
          </div>

          <div
            v-if="castRows.length === 0"
            class="text-center py-10 theme-input border border-dashed theme-border rounded-xl theme-text-muted"
          >
            {{ $t("projectEditor.noCastMembers") }}
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex justify-end pt-4">
        <button
          type="submit"
          :disabled="isSaving"
          class="px-8 py-3 theme-primary-bg hover:bg-[var(--app-color-primary-hover)] font-bold rounded-xl flex items-center space-x-2 transition-colors disabled:opacity-50"
        >
          <Loader2Icon v-if="isSaving" class="w-5 h-5 animate-spin" />
          <span v-else>{{ $t("projectEditor.saveGameProject") }}</span>
        </button>
      </div>
    </form>

    <!-- Inline Create Studio Dialog -->
    <DialogRoot v-model:open="isCreateStudioOpen">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 bg-black/60 z-[110] backdrop-blur-sm" />
        <DialogContent
          class="fixed top-1/2 left-1/2 -trangray-x-1/2 -trangray-y-1/2 theme-surface-overlay border theme-border rounded-2xl p-6 shadow-2xl z-[120] w-[400px]"
        >
          <DialogTitle class="text-lg font-bold theme-text mb-4">{{
            $t("projectEditor.createNewStudio")
          }}</DialogTitle>
          <VisuallyHidden
            ><DialogDescription>{{
              $t("projectEditor.formCreateStudio")
            }}</DialogDescription></VisuallyHidden
          >
          <input
            v-model="newStudioName"
            type="text"
            placeholder="Studio Name"
            class="w-full px-4 py-2 theme-input border theme-border rounded-lg theme-text mb-4"
          />
          <div class="flex justify-end gap-2">
            <button
              @click="isCreateStudioOpen = false"
              class="px-4 py-2 theme-text-secondary theme-hover-text"
            >
              {{ $t("common.cancel") }}
            </button>
            <button
              @click="createStudio"
              :disabled="!newStudioName || isCreatingStudio"
              class="px-4 py-2 theme-primary-bg theme-primary-border rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              <Loader2Icon v-if="isCreatingStudio" class="w-4 h-4 animate-spin" />
              <span>{{ $t("common.create") }}</span>
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- Inline Create Voice Actor Dialog -->
    <DialogRoot v-model:open="isCreateVaOpen">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 bg-black/60 z-[110] backdrop-blur-sm" />
        <DialogContent
          class="fixed top-1/2 left-1/2 -trangray-x-1/2 -trangray-y-1/2 theme-surface-overlay border theme-border rounded-2xl p-6 shadow-2xl z-[120] w-[400px]"
        >
          <DialogTitle class="text-lg font-bold theme-text mb-4">{{
            $t("projectEditor.createNewVoiceActor")
          }}</DialogTitle>
          <VisuallyHidden
            ><DialogDescription>{{
              $t("projectEditor.formCreateVoiceActor")
            }}</DialogDescription></VisuallyHidden
          >
          <div class="space-y-4 mb-4">
            <input
              v-model="newVaFirstname"
              type="text"
              required
              placeholder="First Name"
              class="w-full px-4 py-2 theme-input border theme-border rounded-lg theme-text"
            />
            <input
              v-model="newVaLastname"
              type="text"
              required
              placeholder="Last Name"
              class="w-full px-4 py-2 theme-input border theme-border rounded-lg theme-text"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button
              @click="cancelCreateVaDialog"
              class="px-4 py-2 theme-text-secondary theme-hover-text"
            >
              {{ $t("common.cancel") }}
            </button>
            <button
              @click="createVoiceActor"
              :disabled="!newVaFirstname.trim() || !newVaLastname.trim() || isCreatingVa"
              class="px-4 py-2 theme-primary-bg theme-primary-border rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              <Loader2Icon v-if="isCreatingVa" class="w-4 h-4 animate-spin" />
              <span>{{ $t("common.create") }}</span>
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- Toast -->
    <div
      v-if="toast.show"
      class="fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl text-sm max-w-sm flex flex-col gap-2 theme-surface-overlay theme-border theme-text"
    >
      <span>{{ toast.message }}</span>
      <a
        v-if="toast.link"
        :href="toast.link"
        target="_blank"
        class="theme-status-info-text hover:underline"
        >{{ $t("projectEditor.viewDetails") }}</a
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { validateDubbingLanguage } from "@app/shared-logic";
import { refDebounced } from "@vueuse/core";
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
} from "reka-ui";
import { Gamepad2Icon, Loader2Icon, ImageIcon, XIcon } from "lucide-vue-next";
import {
  createDubbingProjectSaveClient,
  createStableRequestIdFactory,
  getDubbingProjectSaveErrorMessage,
  getEditableDubbingProjectStatus,
  serializeGameProjectCastRows,
  type GameProjectCastEditorRow,
  type DubbingProjectSaveResponse,
} from "~/utils/dubbing-project-save";

const supabase = useSupabaseClient();
const saveDubbingProject = createDubbingProjectSaveClient((body) =>
  $fetch<DubbingProjectSaveResponse>("/api/save-dubbing-project", {
    method: "POST",
    body,
  }),
);
const characterReferenceRequestIds = createStableRequestIdFactory();
const gameCharacterCreateRequestIds = createStableRequestIdFactory();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const { t } = useI18n();

const gameIdParam = Array.isArray(route.params.gameId)
  ? route.params.gameId[0]
  : route.params.gameId;
const projectIdParam = Array.isArray(route.params.projectId)
  ? route.params.projectId[0]
  : route.params.projectId;

const isEditMode = computed(() => !!projectIdParam && projectIdParam !== "new");
const igdbGameId = computed(() =>
  gameIdParam && gameIdParam !== "new" ? Number(gameIdParam) : null,
);

const gameDubbingProjects = ref<GameProjectTab[]>([]);

// Form state
const contentId = ref<number | null>(null);
const mediaTitle = ref("");
const contentType = ref("video_game");
const dubbingLanguage = ref("");
const posterUrl = ref("");
const status = ref<"validated" | "pending" | "draft">("validated");
const selectedStudioId = ref<number | null>(null);
const projectUpdatedAt = ref<string | null>(null);

// Crew state
const artisticDirectorId = ref<number | null>(null);
const adaptationId = ref<number | null>(null);
const recordingId = ref<number | null>(null);
const editingId = ref<number | null>(null);
const mixingId = ref<number | null>(null);
const projectManagerId = ref<number | null>(null);
const creativeSupervisionId = ref<number | null>(null);

// Autocomplete State
const studioOptions = ref<SelectOption[]>([]);
const isSearchingStudios = ref(false);
const voiceActorOptions = ref<SelectOption[]>([]);
const isSearchingVoiceActors = ref(false);
const optionsCache = ref<Map<number, string>>(new Map());

// Dialog State
const isCreateStudioOpen = ref(false);
const newStudioName = ref("");
const isCreateVaOpen = ref(false);
const newVaFirstname = ref("");
const newVaLastname = ref("");
let pendingVaSelectCallback: ((id: number) => void) | null = null;
let pendingVaCreationRequest: { payload: string; requestId: string } | null = null;

// Cast Rows
type CastRow = GameProjectCastEditorRow;
const castRows = ref<CastRow[]>([]);

type SelectOption = { id: number; name: string };
type GameProjectTab = {
  id: number;
  language: string | null;
  studio_id: number | null;
  studios: { name: string | null } | null;
};
type GameProjectCrew = {
  job_id: number;
  person_id: number;
  voice_actors: { firstname: string | null; lastname: string | null } | null;
};
type GameProjectWork = {
  id: number;
  actor_id: number | null;
  character_id: number | null;
  game_character_id: string | null;
  character_name: string | null;
  voice_actor_id: number | null;
  performance: string | null;
  note: string | null;
  highlight: boolean | null;
  status: string | null;
  updated_at: string | null;
  voice_actors: { firstname: string | null; lastname: string | null } | null;
};
type GameProjectRecord = {
  id: number;
  content_id: number;
  content_type: string;
  language: string | null;
  status: string | null;
  studio_id: number | null;
  updated_at: string | null;
  studios: { name: string | null } | null;
  work: GameProjectWork[];
};
type GameApiResponse = {
  game: { name: string; cover?: { url?: string | null } | null } | null;
  characters: GameCharacterApiRow[];
  character_catalog_status: "available" | "unavailable";
};
type GameEditorData = {
  igdbData: GameApiResponse | null;
  projects: GameProjectTab[];
  project: GameProjectRecord | null;
  studioName: string | null;
  crew: GameProjectCrew[];
  works: GameProjectWork[];
  initialStudios: SelectOption[];
  initialVoiceActors: SelectOption[];
};

type GameCharacterOption = {
  id: number | string;
  name: string;
  game_character_id: string | null;
  igdb_character_id: number | null;
  wikidata_qid: string | null;
  identity_source: "igdb" | "local";
  local_name: string | null;
  local_updated_at: string | null;
  igdb_candidate_ids: number[];
  mug_shot?: { image_id: string; url?: string } | null;
};

type GameCharacterApiRow = Omit<GameCharacterOption, "id"> & {
  id: number | null;
  stable_id: string;
};

// Toast
const toast = ref({ show: false, message: "", type: "info", link: "" });
const showToast = (message: string, type = "info", link = "") => {
  toast.value = { show: true, message, type, link };
  setTimeout(() => (toast.value.show = false), 5000);
};

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return "Inconnu";
  try {
    const displayNames = new Intl.DisplayNames(["fr"], { type: "language" });
    const name = displayNames.of(langCode);
    return typeof name === "string" && name.length > 0
      ? name.charAt(0).toUpperCase() + name.slice(1)
      : langCode;
  } catch (e) {
    return langCode;
  }
};

const isFetchingIgdb = ref(false);
const isCreatingGameCharacter = ref(false);
const isUpdatingCharacterReferences = ref(false);
const wikidataDrafts = ref<Record<string, string>>({});
const isSaving = ref(false);
const isLoading = ref(true);
const loadError = ref<string | null>(null);

const addCastRow = () => {
  castRows.value.push({
    character_ref: null,
    character_id: null,
    game_character_id: null,
    character_name: "",
    voice_actor_id: null,
    performance: "dialogues",
    note: "",
    highlight: false,
  });
};
const removeCastRow = (index: number) => {
  castRows.value.splice(index, 1);
};

const igdbCharacters = ref<GameCharacterOption[]>([]);
const filteredIgdbCharacters = ref<GameCharacterOption[]>([]);
const characterCatalogStatus = ref<"available" | "unavailable">("available");
const providerCharacterCount = computed(
  () => igdbCharacters.value.filter((character) => character.identity_source === "igdb").length,
);
const characterSearchQuery = ref("");
const debouncedCharacterSearchQuery = refDebounced(characterSearchQuery, 150);
let characterSearchRow: CastRow | null = null;

const searchCharacters = (row: CastRow, query: string) => {
  characterSearchRow = row;
  characterSearchQuery.value = query;
};

watch(debouncedCharacterSearchQuery, (query) => {
  if (!query) {
    filteredIgdbCharacters.value = igdbCharacters.value.slice(0, 50);
    return;
  }
  filteredIgdbCharacters.value = igdbCharacters.value
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 50);
});

const getCharacterName = (id: number | string | null) => {
  if (!id) return "";
  const char = igdbCharacters.value.find((c) => c.id === id);
  return char ? char.name : "";
};

const handleCharacterSelect = (row: CastRow, val: number | string | null) => {
  if (val === null) {
    row.character_ref = null;
    row.character_id = null;
    row.game_character_id = null;
    row.character_name = "";
    return;
  }
  const char = igdbCharacters.value.find((c) => c.id === val);
  if (char) {
    row.character_ref = char.id;
    row.character_id = char.igdb_character_id;
    row.game_character_id = char.game_character_id;
    row.character_name = char.game_character_id ? char.local_name || char.name : char.name;
  }
};

const handleCharacterFreeText = (row: CastRow) => {
  const query = characterSearchRow === row ? characterSearchQuery.value.trim() : "";
  const name = query || row.character_name.trim();
  if (!name) {
    showToast("Enter a role name before choosing free text.", "error");
    return;
  }
  row.character_ref = null;
  row.character_id = null;
  row.game_character_id = null;
  row.character_name = name;
  characterSearchQuery.value = "";
  characterSearchRow = null;
};

const handleCharacterCreate = async (row: CastRow, query: string) => {
  if (isCreatingGameCharacter.value) return;
  const gameId = contentId.value ?? igdbGameId.value;
  const name = query.trim();
  if (!gameId || !name) return;

  const payload = { igdb_game_id: gameId, name };
  isCreatingGameCharacter.value = true;
  try {
    const created = await $fetch<{
      character: { id: string };
    }>("/api/game-characters", {
      method: "POST",
      body: {
        request_id: gameCharacterCreateRequestIds.forPayload(payload),
        ...payload,
      },
    });
    await reloadGameCharacterOptions();
    const local = igdbCharacters.value.find(
      (character) =>
        character.identity_source === "local" &&
        character.game_character_id === created.character.id,
    );
    if (!local) throw new Error("Created game character was not returned");

    gameCharacterCreateRequestIds.clear();
    handleCharacterSelect(row, local.id);
  } catch (error) {
    showToast(getDubbingProjectSaveErrorMessage(error), "error");
  } finally {
    isCreatingGameCharacter.value = false;
  }
};

const getLocalCharacter = (row: CastRow) =>
  row.game_character_id
    ? (igdbCharacters.value.find(
        (character) => character.game_character_id === row.game_character_id,
      ) ?? null)
    : null;

const getIgdbCandidates = (row: CastRow) => {
  const local = getLocalCharacter(row);
  if (!local) return [];
  return local.igdb_candidate_ids.flatMap((id: number) => {
    const candidate = igdbCharacters.value.find(
      (character) => character.identity_source === "igdb" && character.igdb_character_id === id,
    );
    return candidate ? [candidate] : [];
  });
};

const getWikidataDraft = (row: CastRow) => {
  if (!row.game_character_id) return "";
  return wikidataDrafts.value[row.game_character_id] ?? getLocalCharacter(row)?.wikidata_qid ?? "";
};

const setWikidataDraft = (row: CastRow, event: Event) => {
  if (!row.game_character_id || !(event.target instanceof HTMLInputElement)) return;
  wikidataDrafts.value[row.game_character_id] = event.target.value;
};

const reloadGameCharacterOptions = async () => {
  const gameId = contentId.value ?? igdbGameId.value;
  if (!gameId) return;
  const data = await $fetch<{
    characters: GameCharacterApiRow[];
    character_catalog_status: "available" | "unavailable";
  }>(`/api/game/${gameId}`);
  characterCatalogStatus.value = data.character_catalog_status;
  igdbCharacters.value = data.characters.map((character) => ({
    ...character,
    id: character.stable_id ?? `igdb_character:${character.id}`,
  }));
  filteredIgdbCharacters.value = igdbCharacters.value.slice(0, 50);
};

const updateGameCharacterReferences = async (
  row: CastRow,
  references: {
    igdb_character_id?: number | null;
    wikidata_qid?: string | null;
  },
) => {
  const local = getLocalCharacter(row);
  if (!local || !local.local_updated_at || !row.game_character_id) return;
  const payload = {
    game_character_id: row.game_character_id,
    expected_updated_at: local.local_updated_at,
    ...references,
  };
  isUpdatingCharacterReferences.value = true;
  try {
    await $fetch(`/api/game-characters/${row.game_character_id}`, {
      method: "PUT",
      body: {
        request_id: characterReferenceRequestIds.forPayload(payload),
        expected_updated_at: payload.expected_updated_at,
        ...references,
      },
    });
    characterReferenceRequestIds.clear();
    await reloadGameCharacterOptions();
    showToast("Game character reference updated.", "success");
  } catch (error) {
    showToast(getDubbingProjectSaveErrorMessage(error), "error");
  } finally {
    isUpdatingCharacterReferences.value = false;
  }
};

const saveWikidataReference = async (row: CastRow) => {
  const qid = getWikidataDraft(row).trim();
  if (qid && !/^Q[1-9][0-9]*$/.test(qid)) {
    showToast("Enter a valid Wikidata QID, such as Q12345.", "error");
    return;
  }
  await updateGameCharacterReferences(row, { wikidata_qid: qid || null });
};

const searchStudios = async (query: string) => {
  isSearchingStudios.value = true;
  try {
    let q = supabase.from("studios").select("id, name").limit(10);
    if (query) {
      q = q.ilike("name", `%${query}%`);
    }
    const { data } = await q;
    studioOptions.value = data || [];
    (data || []).forEach((d) => optionsCache.value.set(d.id, d.name));
  } finally {
    isSearchingStudios.value = false;
  }
};

const searchVoiceActors = async (query: string) => {
  isSearchingVoiceActors.value = true;
  try {
    let q = supabase.from("voice_actors").select("id, firstname, lastname").limit(10);
    if (query) {
      q = q.or(`firstname.ilike.%${query}%,lastname.ilike.%${query}%`);
    }
    const { data } = await q;
    const formatted = (data || []).map((va) => ({
      id: va.id,
      name: `${va.firstname || ""} ${va.lastname || ""}`.trim(),
    }));
    voiceActorOptions.value = formatted;
    formatted.forEach((f) => optionsCache.value.set(f.id, f.name));
  } finally {
    isSearchingVoiceActors.value = false;
  }
};

const getStudioName = (id: number | null) => {
  if (!id) return "";
  return optionsCache.value.get(id) || `Studio #${id}`;
};
const getVoiceActorName = (id: number | null) => {
  if (!id) return "";
  return optionsCache.value.get(id) || `VA #${id}`;
};

// Inline Creation
const studioCreationCallback = ref<((id: number) => void) | null>(null);
const openCreateStudioDialog = (query: string, callback?: (id: number) => void) => {
  newStudioName.value = query;
  studioCreationCallback.value = callback || null;
  isCreateStudioOpen.value = true;
};

const isCreatingStudio = ref(false);
const createStudio = async () => {
  isCreatingStudio.value = true;
  try {
    const { data } = await supabase
      .from("studios")
      .insert({ name: newStudioName.value })
      .select()
      .single();
    if (data) {
      optionsCache.value.set(data.id, data.name);
      studioOptions.value = [{ id: data.id, name: data.name }];
      if (studioCreationCallback.value) {
        studioCreationCallback.value(data.id);
        studioCreationCallback.value = null;
      }
      isCreateStudioOpen.value = false;
      showToast(`Created ${data.name}`, "success", `/studio/${data.id}`);
    }
  } finally {
    isCreatingStudio.value = false;
  }
};

const openCreateVaDialog = (query: string, callback?: (id: number) => void) => {
  const parts = query.trim().split(/\s+/);
  newVaFirstname.value = parts[0] || "";
  newVaLastname.value = parts.slice(1).join(" ") || "";
  pendingVaSelectCallback = callback || null;
  const queryPayload = JSON.stringify({
    firstname: newVaFirstname.value.trim(),
    lastname: newVaLastname.value.trim(),
  });
  if (pendingVaCreationRequest?.payload !== queryPayload) {
    pendingVaCreationRequest = null;
  }
  isCreateVaOpen.value = true;
};

const cancelCreateVaDialog = () => {
  isCreateVaOpen.value = false;
  pendingVaCreationRequest = null;
};

const isCreatingVa = ref(false);
const createVoiceActor = async () => {
  const payload = {
    firstname: newVaFirstname.value.trim(),
    lastname: newVaLastname.value.trim(),
  };
  if (!payload.firstname || !payload.lastname) {
    showToast("First name and last name are required.", "error");
    return;
  }

  const payloadKey = JSON.stringify(payload);
  if (pendingVaCreationRequest?.payload !== payloadKey) {
    pendingVaCreationRequest = {
      payload: payloadKey,
      requestId: crypto.randomUUID(),
    };
  }

  isCreatingVa.value = true;
  try {
    const { data } = await useMetadataCreation().createVoiceActor(
      payload,
      pendingVaCreationRequest.requestId,
    );
    if (data) {
      const name = `${data.firstname || ""} ${data.lastname || ""}`.trim();
      optionsCache.value.set(data.id, name);
      voiceActorOptions.value = [{ id: data.id, name }];
      if (pendingVaSelectCallback) {
        pendingVaSelectCallback(data.id);
        pendingVaSelectCallback = null;
      }
      isCreateVaOpen.value = false;
      showToast(`Created ${name}`, "success");
      pendingVaCreationRequest = null;
    }
  } catch (error: unknown) {
    showToast(error instanceof Error ? error.message : "Failed to create voice actor.", "error");
  } finally {
    isCreatingVa.value = false;
  }
};

const saveGameProject = async () => {
  if (!contentId.value) return showToast("IGDB ID required", "error");
  if (!dubbingLanguage.value) return showToast("Language required", "error");
  isSaving.value = true;
  try {
    let projectId = isEditMode.value ? Number(projectIdParam) : null;
    const crew: Array<{ job_id: number; person_id: number }> = [];
    if (artisticDirectorId.value !== null)
      crew.push({ job_id: 1, person_id: artisticDirectorId.value });
    if (adaptationId.value !== null) crew.push({ job_id: 2, person_id: adaptationId.value });
    if (recordingId.value !== null) crew.push({ job_id: 3, person_id: recordingId.value });
    if (editingId.value !== null) crew.push({ job_id: 4, person_id: editingId.value });
    if (mixingId.value !== null) crew.push({ job_id: 5, person_id: mixingId.value });
    if (projectManagerId.value !== null)
      crew.push({ job_id: 6, person_id: projectManagerId.value });
    if (creativeSupervisionId.value !== null)
      crew.push({ job_id: 7, person_id: creativeSupervisionId.value });

    const cast = serializeGameProjectCastRows(castRows.value);

    const result = await saveDubbingProject({
      project_id: projectId,
      expected_updated_at: projectId === null ? null : projectUpdatedAt.value,
      project: {
        content_id: contentId.value,
        content_type: "video_game",
        language: validateDubbingLanguage(dubbingLanguage.value),
        studio_id: selectedStudioId.value,
        status: status.value,
      },
      crew,
      cast,
    });
    projectId = result.projectId;
    projectUpdatedAt.value = result.updatedAt;

    showToast("Project saved successfully!", "success");
    if (isEditMode.value) {
      await refreshProject();
    } else if (projectId && contentId.value) {
      await router.push(localePath(`/game/${contentId.value}/projects/${projectId}/edit`));
    }
  } catch (err: unknown) {
    showToast(getDubbingProjectSaveErrorMessage(err), "error");
  } finally {
    isSaving.value = false;
  }
};

const {
  data: initialData,
  error: initialDataError,
  refresh: refreshProject,
} = await useAsyncData(
  `game-edit-${igdbGameId.value}-${projectIdParam}`,
  async () => {
    let igdbData: GameApiResponse | null = null;
    let projects: GameProjectTab[] = [];
    let project: GameProjectRecord | null = null;
    let studioName: string | null = null;
    let crew: GameProjectCrew[] = [];
    let works: GameProjectWork[] = [];

    if (igdbGameId.value) {
      // IGDB metadata
      try {
        const data = await $fetch<GameApiResponse>(`/api/game/${igdbGameId.value}`);
        if (data) {
          igdbData = data;
        }
      } catch (e) {
        console.error("Failed to fetch IGDB data.", e);
      }

      // Fetch all dubbing projects for this game for the tabs
      const { data: pData } = await supabase
        .from("dubbing_projects")
        .select("id, language, studio_id, studios(name)")
        .eq("content_id", igdbGameId.value)
        .eq("content_type", "video_game");
      projects = pData || [];
    }

    if (isEditMode.value) {
      const projectId = Number(projectIdParam);
      const { data: proj, error: projectError } = await supabase
        .from("dubbing_projects")
        .select("*, studios(name), work(*, voice_actors(firstname, lastname))")
        .eq("id", projectId)
        .single();
      if (projectError || !proj) throw projectError || new Error("Project not found");
      project = proj;
      studioName = proj.studios?.name || null;
      works = proj.work || [];

      const { data: cData, error: crewError } = await supabase
        .from("dubbing_project_crew")
        .select("job_id, person_id, voice_actors(firstname, lastname)")
        .eq("dubbing_project_id", projectId);
      if (crewError) throw crewError;
      crew = cData || [];
    }

    // Pre-fetch initial dropdown options
    const { data: studiosData } = await supabase.from("studios").select("id, name").limit(10);
    const initialStudios = studiosData || [];

    const { data: vaData } = await supabase
      .from("voice_actors")
      .select("id, firstname, lastname")
      .limit(10);
    const initialVoiceActors = (vaData || []).map((va) => ({
      id: va.id,
      name: `${va.firstname || ""} ${va.lastname || ""}`.trim(),
    }));

    return {
      igdbData,
      projects,
      project,
      studioName,
      crew,
      works,
      initialStudios,
      initialVoiceActors,
    };
  },
  { getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp) },
);

watch(
  [initialData, initialDataError],
  ([data, error]) => {
    if (error) {
      loadError.value = t("common.error");
      isLoading.value = false;
      return;
    }

    if (data) {
      if (data.igdbData) {
        contentId.value = igdbGameId.value;
        characterCatalogStatus.value =
          data.igdbData.character_catalog_status === "unavailable" ? "unavailable" : "available";
        if (data.igdbData.game) {
          mediaTitle.value = data.igdbData.game.name;
          posterUrl.value = data.igdbData.game.cover?.url?.replace("t_thumb", "t_cover_big") || "";
        }
        if (data.igdbData.characters) {
          igdbCharacters.value = data.igdbData.characters.map((character: GameCharacterApiRow) => ({
            ...character,
            id: character.stable_id ?? `igdb_character:${character.id}`,
          }));
          filteredIgdbCharacters.value = igdbCharacters.value.slice(0, 50);
        }
      }

      gameDubbingProjects.value = data.projects;

      if (data.project) {
        contentId.value = data.project.content_id;
        contentType.value = data.project.content_type;
        dubbingLanguage.value = data.project.language || "";
        status.value = getEditableDubbingProjectStatus(data.project.status);
        selectedStudioId.value = data.project.studio_id;
        projectUpdatedAt.value = data.project.updated_at;
        if (data.studioName && data.project.studio_id !== null) {
          optionsCache.value.set(data.project.studio_id, data.studioName);
        }
      }

      artisticDirectorId.value = null;
      adaptationId.value = null;
      recordingId.value = null;
      editingId.value = null;
      mixingId.value = null;
      projectManagerId.value = null;
      creativeSupervisionId.value = null;
      if (data.crew) {
        data.crew.forEach((c) => {
          const name =
            `${c.voice_actors?.firstname || ""} ${c.voice_actors?.lastname || ""}`.trim();
          optionsCache.value.set(c.person_id, name);
          if (c.job_id === 1) artisticDirectorId.value = c.person_id;
          if (c.job_id === 2) adaptationId.value = c.person_id;
          if (c.job_id === 3) recordingId.value = c.person_id;
          if (c.job_id === 4) editingId.value = c.person_id;
          if (c.job_id === 5) mixingId.value = c.person_id;
          if (c.job_id === 6) projectManagerId.value = c.person_id;
          if (c.job_id === 7) creativeSupervisionId.value = c.person_id;
        });
      }

      if (data.works) {
        castRows.value = data.works.map((w) => {
          const linkedCharacter = w.game_character_id
            ? null
            : igdbCharacters.value.find(
                (character) =>
                  character.identity_source === "local" &&
                  character.igdb_character_id === w.character_id,
              );
          const gameCharacterId = w.game_character_id ?? linkedCharacter?.game_character_id ?? null;
          if (w.voice_actors && w.voice_actor_id !== null) {
            const name =
              `${w.voice_actors.firstname || ""} ${w.voice_actors.lastname || ""}`.trim();
            optionsCache.value.set(w.voice_actor_id, name);
          }
          return {
            id: w.id,
            character_ref: gameCharacterId
              ? `game_character:${gameCharacterId}`
              : w.character_id
                ? `igdb_character:${w.character_id}`
                : null,
            character_id: w.character_id,
            game_character_id: gameCharacterId,
            character_name: w.character_name || "",
            voice_actor_id: w.voice_actor_id,
            performance: w.performance || "dialogues",
            note: w.note || "",
            highlight: w.highlight ?? false,
            expectedUpdatedAt: w.updated_at,
            expected: {
              actor_id: w.actor_id,
              character_id: w.character_id,
              game_character_id: w.game_character_id ?? null,
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

      if (data.initialStudios) {
        studioOptions.value = data.initialStudios;
        data.initialStudios.forEach((d) => optionsCache.value.set(d.id, d.name));
      }

      if (data.initialVoiceActors) {
        voiceActorOptions.value = data.initialVoiceActors;
        data.initialVoiceActors.forEach((f) => optionsCache.value.set(f.id, f.name));
      }

      isLoading.value = false;
    }
  },
  { immediate: true },
);
</script>
