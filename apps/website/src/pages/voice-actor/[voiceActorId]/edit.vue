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
        :to="localePath(id ? `/voice-actor/${id}` : '/')"
        class="text-xs font-semibold px-4 py-2.5 theme-surface-muted theme-hover-surface-muted theme-text-secondary theme-hover-text rounded-xl border theme-border transition-colors"
      >
        ←
        {{
          id
            ? $t("voiceActorEdit.backToVoiceActor")
            : $t("voiceActorEdit.backHome")
        }}
      </NuxtLink>
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
          <img
            v-if="previewImage"
            :src="previewImage"
            class="h-full w-full object-cover"
            alt="Profile Picture Preview"
          />
          <NuxtImg
            format="webp"
            v-else-if="resolvedProfilePicture"
            :src="resolvedProfilePicture"
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
            <select
              v-model="nationality"
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-sm appearance-none"
            >
              <option value="" disabled>
                {{ $t("voiceActorEdit.selectNationality") }}
              </option>
              <option value="Français">{{ $t("language.fr") }}</option>
              <option value="Belge">
                {{ $t("voiceActorEdit.nationalityBelgian") }}
              </option>
              <option value="Suisse">
                {{ $t("voiceActorEdit.nationalitySwiss") }}
              </option>
              <option value="Québécois(e)">
                {{ $t("voiceActorEdit.nationalityQuebecois") }}
              </option>
              <option value="Américain(e)">
                {{ $t("voiceActorEdit.nationalityAmerican") }}
              </option>
              <option value="Britannique">
                {{ $t("voiceActorEdit.nationalityBritish") }}
              </option>
              <option value="Japonais(e)">
                {{ $t("voiceActorEdit.nationalityJapanese") }}
              </option>
              <option value="Autre">{{ $t("report.reasons.other") }}</option>
            </select>
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
        <div class="space-y-4">
          <label
            class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
            >{{ $t("voiceActorEdit.socialMediaLinks") }}</label
          >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1">
              <label
                class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("voiceActorEdit.instagram") }}</label
              >
              <input
                v-model="socialMedia.instagram"
                type="url"
                placeholder="https://instagram.com/..."
                class="w-full px-4 py-2 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-xs"
              />
            </div>
            <div class="space-y-1">
              <label
                class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("voiceActorEdit.twitterX") }}</label
              >
              <input
                v-model="socialMedia.twitter"
                type="url"
                placeholder="https://twitter.com/..."
                class="w-full px-4 py-2 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-xs"
              />
            </div>
            <div class="space-y-1">
              <label
                class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("voiceActorEdit.tiktok") }}</label
              >
              <input
                v-model="socialMedia.tiktok"
                type="url"
                placeholder="https://tiktok.com/@..."
                class="w-full px-4 py-2 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-xs"
              />
            </div>
            <div class="space-y-1">
              <label
                class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("voiceActorEdit.facebook") }}</label
              >
              <input
                v-model="socialMedia.facebook"
                type="url"
                placeholder="https://facebook.com/..."
                class="w-full px-4 py-2 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-xs"
              />
            </div>
            <div class="space-y-1 md:col-span-2">
              <label
                class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("voiceActorEdit.website") }}</label
              >
              <input
                v-model="socialMedia.website"
                type="url"
                placeholder="https://..."
                class="w-full px-4 py-2 theme-input border theme-border rounded-xl theme-text theme-placeholder theme-focus text-xs"
              />
            </div>
          </div>
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

    <!-- Linked Works & Filmography (Bidirectional Linking) -->
    <div
      v-if="isEditMode"
      class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-4 shadow-xl"
    >
      <div class="flex justify-between items-center border-b theme-border pb-3">
        <div>
          <h4 class="text-base font-bold theme-text">
            {{ $t("voiceActorEdit.linkedWorksFilmography") }}
          </h4>
          <p class="text-xs theme-text-muted">
            {{ $t("voiceActorEdit.allCreditsLinked") }}
          </p>
        </div>
        <button
          @click="showLinkWorkModal = true"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1"
        >
          <span>{{ $t("voiceActorEdit.linkNewWork") }}</span>
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm theme-text-secondary">
          <thead
            class="theme-input text-xs font-semibold uppercase theme-text-muted border-b theme-border"
          >
            <tr>
              <th class="px-4 py-3">{{ $t("voiceActorEdit.workId") }}</th>
              <th class="px-4 py-3">
                {{ $t("voiceActorEdit.mediaContentId") }}
              </th>
              <th class="px-4 py-3">{{ $t("admin.queue.type") }}</th>
              <th class="px-4 py-3">{{ $t("details.character") }}</th>
              <th class="px-4 py-3">
                {{ $t("admin.movieEditor.performance") }}
              </th>
              <th class="px-4 py-3 text-right">
                {{ $t("voiceActorEdit.editProject") }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y theme-divide">
            <tr
              v-for="work in linkedWorks as any[]"
              :key="work.id"
              class="theme-input transition-colors"
            >
              <td class="px-4 py-3 font-mono text-xs theme-text-muted">
                #{{ work.id }}
              </td>
              <td class="px-4 py-3 font-mono text-xs theme-status-info-text">
                {{ $t("voiceActorEdit.projectNumber")
                }}{{ work.dubbing_project_id }}
                <span
                  v-if="work.dubbing_projects?.content_id"
                  class="theme-text-muted text-[10px] block"
                  >{{ $t("voiceActorEdit.contentNumber")
                  }}{{ work.dubbing_projects.content_id }}
                </span>
              </td>
              <td
                class="px-4 py-3 uppercase text-[10px] font-bold tracking-wider theme-text-muted"
              >
                <span
                  class="px-2 py-0.5 rounded theme-surface-muted border theme-border"
                >
                  {{
                    work.dubbing_projects?.content_type ||
                    work.content_type ||
                    "movie"
                  }}
                </span>
              </td>
              <td class="px-4 py-3 font-medium theme-text">
                {{ work.character_name || work.suggestions || "Character" }}
              </td>
              <td class="px-4 py-3 text-xs theme-text-muted">
                {{ work.performance || "dialogues" }}
              </td>
              <td class="px-4 py-3 text-right">
                <NuxtLink
                  v-if="
                    getProjectEditLink(
                      work.dubbing_projects?.content_type,
                      work.dubbing_projects?.content_id,
                      work.dubbing_project_id,
                    )
                  "
                  :to="
                    localePath(
                      getProjectEditLink(
                        work.dubbing_projects?.content_type,
                        work.dubbing_projects?.content_id,
                        work.dubbing_project_id,
                      ) ?? '/',
                    )
                  "
                  class="px-3 py-1.5 theme-surface-muted theme-hover-surface-muted theme-status-info-text theme-status-info-text text-xs font-semibold rounded-lg border theme-border transition-all inline-flex items-center space-x-1"
                >
                  <span
                    >{{ $t("common.edit")
                    }}{{
                      getMediaTypeLabel(
                        work.dubbing_projects?.content_type ||
                          work.content_type,
                      )
                    }}</span
                  >
                  <span>↗</span>
                </NuxtLink>
                <span
                  v-else
                  class="inline-flex items-center px-3 py-1.5 theme-text-muted text-xs rounded-lg border theme-border"
                  :title="$t('voiceActorEdit.unsupportedMediaType')"
                >
                  {{ $t("voiceActorEdit.unsupportedMediaType") }}
                </span>
              </td>
            </tr>
            <tr v-if="linkedWorks.length === 0">
              <td colspan="6" class="text-center py-6 theme-text-muted text-xs">
                {{ $t("voiceActorEdit.noLinkedWorks") }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Link New Work Modal -->
    <div
      v-if="showLinkWorkModal"
      class="fixed inset-0 z-50 flex items-start justify-center theme-input backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div
        class="theme-surface-overlay border theme-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl my-8"
      >
        <div
          class="flex justify-between items-center pb-4 border-b theme-border"
        >
          <div>
            <h3 class="text-base font-bold theme-text">
              {{ $t("voiceActorEdit.linkNewWork") }}
            </h3>
            <p class="text-xs theme-text-muted mt-0.5">
              {{ $t("voiceActorEdit.linkNewWorkDesc") }}
            </p>
          </div>
          <button
            @click="closeLinkWorkModal"
            class="theme-text-muted theme-hover-text p-1 theme-hover-surface-muted rounded-lg transition-colors"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div v-if="linkWorkStep === 1" class="space-y-4 pt-4">
          <p
            class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
          >
            1. {{ $t("voiceActorEdit.selectMediaType") }}
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              v-for="mt in mediaTypes"
              :key="mt.value"
              @click="
                selectedMediaType = mt.value;
                linkWorkStep = 2;
              "
              class="p-3 rounded-xl border text-left transition-all"
              :class="
                selectedMediaType === mt.value
                  ? 'bg-blue-950/40 border-blue-600'
                  : 'theme-input theme-border theme-hover-border'
              "
            >
              <span class="text-lg block mb-1">{{ mt.icon }}</span>
              <span class="text-xs font-semibold theme-text">{{
                mt.label
              }}</span>
              <span
                v-if="mt.note"
                class="block text-[9px] theme-text-muted mt-0.5"
                >{{ mt.note }}</span
              >
            </button>
          </div>
        </div>

        <div v-if="linkWorkStep === 2" class="space-y-4 pt-4">
          <div class="flex items-center gap-2 mb-2">
            <button
              @click="linkWorkStep = 1"
              class="theme-text-muted theme-hover-text p-1 theme-hover-surface-muted rounded transition-colors"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <p
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
            >
              2. {{ $t("voiceActorEdit.searchOrCreate") }} —
              <span class="theme-status-info-text">{{ mediaTypeLabel }}</span>
            </p>
          </div>

          <div class="flex gap-2">
            <input
              v-model="mediaSearchQuery"
              type="text"
              :placeholder="$t('voiceActorEdit.searchPlaceholder')"
              @input="triggerMediaSearch"
              class="flex-1 px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-focus text-sm"
            />
            <select
              v-model="searchLanguage"
              class="px-3 py-2.5 theme-input border theme-border rounded-xl theme-text text-xs"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="ja">日本語</option>
            </select>
          </div>

          <div v-if="mediaSearchLoading" class="flex justify-center py-6">
            <div
              class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"
            ></div>
          </div>

          <div
            v-else-if="
              mediaSearchResults.length === 0 && mediaSearchQuery.length >= 2
            "
            class="text-center py-6"
          >
            <p class="theme-text-muted text-sm mb-3">
              {{ $t("voiceActorEdit.noResults") }}
            </p>
            <button
              @click="showCreateMedia = true"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
            >
              + {{ $t("voiceActorEdit.createNew") }}
            </button>
          </div>

          <div
            v-else-if="mediaSearchResults.length > 0"
            class="space-y-2 max-h-64 overflow-y-auto"
          >
            <button
              v-for="item in mediaSearchResults"
              :key="`${item.media_type}-${item.id}`"
              @click="selectMediaItem(item)"
              class="w-full flex items-center gap-3 p-3 theme-input theme-hover-surface-muted border theme-border theme-hover-border rounded-xl text-left transition-all"
            >
              <div
                class="h-10 w-8 rounded overflow-hidden border theme-border theme-surface-overlay shrink-0 flex items-center justify-center theme-text-secondary"
              >
                <img
                  v-if="item.poster_path || item.cover_url"
                  :src="item.poster_path || item.cover_url"
                  class="h-full w-full object-cover"
                />
                <span v-else class="text-[8px]">N/A</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold theme-text truncate">
                  {{ item.title || item.name }}
                </p>
                <p
                  class="text-[10px] theme-text-muted uppercase tracking-wider"
                >
                  {{ getMediaTypeLabel(item.media_type) }}
                  <span v-if="item.release_date || item.first_air_date">
                    ·
                    {{
                      (item.release_date || item.first_air_date || "").split(
                        "-",
                      )[0]
                    }}</span
                  >
                  <span v-if="item.author"> · {{ item.author }}</span>
                  <span v-if="item.brand"> · {{ item.brand }}</span>
                </p>
              </div>
              <span class="theme-text-secondary text-xs shrink-0">→</span>
            </button>
          </div>

          <div class="pt-2 border-t theme-border">
            <button
              @click="showCreateMedia = true"
              class="w-full py-2.5 border border-dashed theme-border theme-hover-border-strong theme-text-muted theme-hover-text text-xs font-semibold rounded-xl transition-all"
            >
              + {{ $t("voiceActorEdit.createNew") }} {{ mediaTypeLabel }}
            </button>
          </div>
        </div>

        <div v-if="linkWorkStep === 3" class="space-y-4 pt-4">
          <div class="flex items-center gap-2 mb-2">
            <button
              @click="linkWorkStep = 2"
              class="theme-text-muted theme-hover-text p-1 theme-hover-surface-muted rounded transition-colors"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <p
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
            >
              3. {{ $t("voiceActorEdit.linkRole") }}
            </p>
          </div>

          <div
            class="flex items-center gap-3 p-3 theme-input rounded-xl border theme-border"
          >
            <div
              class="h-14 w-10 rounded overflow-hidden border theme-border theme-surface-overlay shrink-0 flex items-center justify-center theme-text-secondary"
            >
              <img
                v-if="selectedMedia?.poster_path || selectedMedia?.cover_url"
                :src="selectedMedia.poster_path || selectedMedia.cover_url"
                class="h-full w-full object-cover"
              />
              <span v-else class="text-[8px]">N/A</span>
            </div>
            <div>
              <p class="text-sm font-bold theme-text">
                {{ selectedMedia?.title || selectedMedia?.name }}
              </p>
              <p class="text-[10px] theme-text-muted uppercase tracking-wider">
                {{ getMediaTypeLabel(selectedMedia?.media_type) }}
              </p>
            </div>
          </div>

          <div v-if="linkWorkCastLoading" class="flex justify-center py-6">
            <div
              class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"
            ></div>
          </div>

          <div
            v-else-if="linkWorkCast.length > 0"
            class="space-y-2 max-h-56 overflow-y-auto"
          >
            <p
              class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
            >
              {{ $t("voiceActorEdit.selectRole") }}
            </p>
            <button
              v-for="castMember in linkWorkCast"
              :key="castMember.id"
              @click="
                submitWorkLink({
                  actorId: castMember.id,
                  characterName: castMember.character || castMember.name,
                })
              "
              class="w-full flex items-center gap-3 p-2.5 theme-input theme-hover-surface-muted border theme-border theme-hover-border rounded-xl text-left transition-all"
            >
              <div
                class="h-8 w-8 rounded-full overflow-hidden border theme-border theme-surface-overlay shrink-0 flex items-center justify-center theme-text-muted"
              >
                <img
                  v-if="castMember.profile_path"
                  :src="castMember.profile_path"
                  class="h-full w-full object-cover"
                />
                <span v-else class="text-[8px]">?</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-semibold theme-text truncate">
                  {{ castMember.name }}
                </p>
                <p class="text-[10px] theme-status-info-text truncate">
                  as {{ castMember.character || castMember.name }}
                </p>
              </div>
            </button>
          </div>

          <div v-else class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label
                  class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                  >{{ $t("voiceActorEdit.originalActor") }}</label
                >
                <input
                  v-model="linkWorkActorName"
                  type="text"
                  :placeholder="$t('voiceActorEdit.originalActorPlaceholder')"
                  class="w-full px-3 py-2 theme-input border theme-border rounded-xl theme-text theme-focus text-xs"
                />
              </div>
              <div class="space-y-1">
                <label
                  class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                  >{{ $t("voiceActorEdit.characterName") }}</label
                >
                <input
                  v-model="linkWorkCharacterName"
                  type="text"
                  :placeholder="$t('voiceActorEdit.characterNamePlaceholder')"
                  class="w-full px-3 py-2 theme-input border theme-border rounded-xl theme-text theme-focus text-xs"
                />
              </div>
            </div>
            <div class="space-y-1">
              <label
                class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("admin.movieEditor.performance") }}</label
              >
              <select
                v-model="linkWorkPerformance"
                class="w-full px-3 py-2 theme-input border theme-border rounded-xl theme-text text-xs"
              >
                <option value="dialogues">
                  {{ $t("admin.movieEditor.dialogues") }}
                </option>
                <option value="chant">
                  {{ $t("admin.movieEditor.chant") }}
                </option>
                <option value="dialogues & chant">
                  {{ $t("admin.movieEditor.dialoguesAndChant") }}
                </option>
                <option value="ambiances">
                  {{ $t("admin.movieEditor.ambiances") }}
                </option>
                <option value="voice">
                  {{ $t("admin.movieEditor.voice") }}
                </option>
              </select>
            </div>
            <button
              @click="
                submitWorkLink({
                  actorName: linkWorkActorName,
                  characterName: linkWorkCharacterName,
                })
              "
              :disabled="isSubmittingWorkLink || !linkWorkCharacterName"
              class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span
                v-if="isSubmittingWorkLink"
                class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
              ></span>
              {{ $t("voiceActorEdit.linkThisWork") }}
            </button>
          </div>
        </div>

        <div
          v-if="showCreateMedia"
          class="mt-4 p-4 theme-input border theme-border rounded-xl space-y-3"
        >
          <p
            class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
          >
            {{ $t("voiceActorEdit.createNew") }} {{ mediaTypeLabel }}
          </p>
          <div class="space-y-1">
            <label
              class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("voiceActorEdit.name") }}</label
            >
            <input
              v-model="createMediaName"
              type="text"
              :placeholder="$t('voiceActorEdit.namePlaceholder')"
              class="w-full px-3 py-2 theme-input border theme-border rounded-xl theme-text theme-focus text-sm"
            />
          </div>
          <div v-if="selectedMediaType === 'advertisement'" class="space-y-1">
            <label
              class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("voiceActorEdit.brand") }}</label
            >
            <input
              v-model="createMediaBrand"
              type="text"
              :placeholder="$t('voiceActorEdit.brandPlaceholder')"
              class="w-full px-3 py-2 theme-input border theme-border rounded-xl theme-text theme-focus text-sm"
            />
          </div>
          <div v-if="selectedMediaType === 'toy'" class="space-y-1">
            <label
              class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("voiceActorEdit.manufacturer") }}</label
            >
            <input
              v-model="createMediaBrand"
              type="text"
              :placeholder="$t('voiceActorEdit.manufacturerPlaceholder')"
              class="w-full px-3 py-2 theme-input border theme-border rounded-xl theme-text theme-focus text-sm"
            />
          </div>
          <div v-if="selectedMediaType === 'audiobook'" class="space-y-1">
            <label
              class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("voiceActorEdit.author") }}</label
            >
            <input
              v-model="createMediaBrand"
              type="text"
              :placeholder="$t('voiceActorEdit.authorPlaceholder')"
              class="w-full px-3 py-2 theme-input border theme-border rounded-xl theme-text theme-focus text-sm"
            />
          </div>
          <div v-if="selectedMediaType === 'podcast'" class="space-y-1">
            <label
              class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("voiceActorEdit.podcastAuthor") }}</label
            >
            <input
              v-model="createMediaBrand"
              type="text"
              :placeholder="$t('voiceActorEdit.podcastAuthorPlaceholder')"
              class="w-full px-3 py-2 theme-input border theme-border rounded-xl theme-text theme-focus text-sm"
            />
          </div>
          <div class="flex gap-2 pt-1">
            <button
              @click="showCreateMedia = false"
              class="px-4 py-2 theme-surface-muted theme-hover-surface-muted theme-text-secondary text-xs font-semibold rounded-xl"
            >
              {{ $t("common.cancel") }}
            </button>
            <button
              @click="createAndLink"
              :disabled="isCreatingMedia || !createMediaName"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              <span
                v-if="isCreatingMedia"
                class="animate-spin rounded-full h-3 w-3 border-b-2 border-white"
              ></span>
              {{ $t("voiceActorEdit.createAndLink") }}
            </button>
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
          ? 'theme-status-success'
          : toast.type === 'error'
            ? 'theme-status-danger'
            : 'theme-surface-overlay theme-border theme-text'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient();

import { ref, onMounted, computed, watch } from "vue";
import { getMediaEditorRoute } from "~/lib/media-editor-routes";

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const voiceActorId = route.params.voiceActorId as string | undefined;
const id = voiceActorId;
const isEditMode = computed(() => !!id && id !== "new");

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return (
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin"
  );
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
  website: "",
});
const tmdbId = ref("");
const wikidataId = ref("");
const profilePicture = ref("");

const resolvedProfilePicture = computed(() => {
  if (!profilePicture.value) return "";
  if (profilePicture.value.startsWith("http")) return profilePicture.value;
  return supabase.storage
    .from("voice_actor_profile_pictures")
    .getPublicUrl(profilePicture.value).data.publicUrl;
});

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
  formData.append(
    "file",
    profilePictureFile.value,
    profilePictureFile.value.name,
  );
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

const linkedWorks = ref<any[]>([]);

function getProjectEditLink(
  contentType?: string | null,
  contentId?: number | string,
  projectId?: number | string,
) {
  return getMediaEditorRoute({ contentType, mediaId: contentId, projectId });
}

function getMediaTypeLabel(contentType?: string | null) {
  if (contentType === "movie") return "Movie";
  if (contentType === "tv") return "Series";
  if (contentType === "video_game") return "Video Game";
  if (contentType === "audiobook") return "Audiobook";
  if (contentType === "podcast") return "Podcast";
  if (contentType === "advertisement") return "Commercial";
  if (contentType === "toy") return "Toy";
  return contentType || "Media";
}

const numId = Number(id);
const { data: initialData } = await useAsyncData(
  `voice-actor-${id}`,
  async () => {
    if (!isEditMode.value || isNaN(numId)) return null;
    const { data: va, error: vaErr } = await supabase
      .from("voice_actors")
      .select("*")
      .eq("id", numId)
      .single();

    if (vaErr) throw vaErr;

    const { data: works, error: worksErr } = await supabase
      .from("work")
      .select("*, dubbing_projects(id, content_id, content_type)")
      .eq("voice_actor_id", numId);

    return {
      voiceActor: va,
      linkedWorks: works || [],
    };
  },
);

watch(
  initialData,
  (data) => {
    if (data) {
      if (data.voiceActor) {
        firstname.value = data.voiceActor.firstname;
        lastname.value = data.voiceActor.lastname;
        bio.value = data.voiceActor.bio || "";
        nationality.value = data.voiceActor.nationality || "";
        dateOfBirth.value = data.voiceActor.date_of_birth || "";
        awards.value = data.voiceActor.awards || "";
        yearsActive.value = data.voiceActor.years_active || "";

        const links = (data.voiceActor.social_media_links as any) || {};
        socialMedia.value = {
          instagram: links.instagram || "",
          twitter: links.twitter || "",
          tiktok: links.tiktok || "",
          facebook: links.facebook || "",
          website: links.website || "",
        };

        tmdbId.value = data.voiceActor.tmdb_id
          ? String(data.voiceActor.tmdb_id)
          : "";
        profilePicture.value = data.voiceActor.profile_picture || "";
        wikidataId.value = data.voiceActor.wikidata_id || "";
      }
      linkedWorks.value = data.linkedWorks;
    }
  },
  { immediate: true },
);

const fetchVoiceActor = async () => {}; // Dummy

const saveVoiceActor = async () => {
  if (!firstname.value || !lastname.value) {
    showToast("First name and Last name are required.", "error");
    return;
  }

  isSaving.value = true;
  const upsertData: any = {
    firstname: firstname.value,
    lastname: lastname.value,
    bio: bio.value || null,
    nationality: nationality.value || null,
    date_of_birth: dateOfBirth.value || null,
    awards: awards.value || null,
    years_active: yearsActive.value || null,
    social_media_links: socialMedia.value,
    tmdb_id: tmdbId.value ? parseInt(tmdbId.value, 10) : null,
    wikidata_id: wikidataId.value || null,
    profile_picture: profilePicture.value || null,
  };

  if (isEditMode.value) {
    upsertData.id = numId;
  }

  try {
    const { data, error: upsertErr } = await supabase
      .from("voice_actors")
      .upsert([upsertData])
      .select();

    if (upsertErr) throw upsertErr;

    let voiceActorId = id;
    if (!isEditMode.value && data && data.length > 0 && data[0]) {
      voiceActorId = String(data[0].id);
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

// Link Work Modal
const showLinkWorkModal = ref(false);
const linkWorkStep = ref(1);
const selectedMediaType = ref("movie");
const mediaSearchQuery = ref("");
const searchLanguage = ref("fr");
const mediaSearchLoading = ref(false);
const mediaSearchResults = ref<any[]>([]);
const selectedMedia = ref<any | null>(null);
const linkWorkCast = ref<any[]>([]);
const linkWorkCastLoading = ref(false);
const linkWorkActorName = ref("");
const linkWorkCharacterName = ref("");
const linkWorkPerformance = ref("dialogues");
const isSubmittingWorkLink = ref(false);
const showCreateMedia = ref(false);
const createMediaName = ref("");
const createMediaBrand = ref("");
const isCreatingMedia = ref(false);
const mediaSearchTimer = ref<ReturnType<typeof setTimeout> | null>(null);
let mediaSearchRequestId = 0;
let creditsRequestId = 0;

const mediaTypes = [
  { value: "movie", label: "Movie", icon: "🎬", note: "TMDB" },
  { value: "tv", label: "Series", icon: "📺", note: "TMDB" },
  { value: "video_game", label: "Video Game", icon: "🎮", note: "IGDB" },
  { value: "audiobook", label: "Audiobook", icon: "📖", note: "" },
  { value: "podcast", label: "Podcast", icon: "🎙️", note: "" },
  { value: "advertisement", label: "Commercial", icon: "📺", note: "" },
  { value: "toy", label: "Toy", icon: "🧸", note: "" },
];

const mediaTypeLabel = computed(() => {
  return (
    mediaTypes.find((m) => m.value === selectedMediaType.value)?.label ??
    selectedMediaType.value
  );
});

function closeLinkWorkModal() {
  mediaSearchRequestId += 1;
  creditsRequestId += 1;
  if (mediaSearchTimer.value) clearTimeout(mediaSearchTimer.value);
  mediaSearchTimer.value = null;
  showLinkWorkModal.value = false;
  linkWorkStep.value = 1;
  selectedMediaType.value = "movie";
  mediaSearchQuery.value = "";
  mediaSearchResults.value = [];
  selectedMedia.value = null;
  linkWorkCast.value = [];
  mediaSearchLoading.value = false;
  linkWorkCastLoading.value = false;
  linkWorkActorName.value = "";
  linkWorkCharacterName.value = "";
  showCreateMedia.value = false;
  createMediaName.value = "";
  createMediaBrand.value = "";
}

function triggerMediaSearch() {
  const requestId = ++mediaSearchRequestId;
  if (mediaSearchTimer.value) clearTimeout(mediaSearchTimer.value);
  mediaSearchTimer.value = setTimeout(() => executeMediaSearch(requestId), 300);
}

async function executeMediaSearch(requestId: number) {
  const q = mediaSearchQuery.value.trim();
  if (q.length < 2) {
    if (requestId === mediaSearchRequestId) {
      mediaSearchResults.value = [];
      mediaSearchLoading.value = false;
    }
    return;
  }
  mediaSearchLoading.value = true;
  try {
    const results = await $fetch<any[]>("/api/search", {
      params: { query: q },
    });
    if (requestId !== mediaSearchRequestId) return;
    mediaSearchResults.value = (results ?? []).filter((r: any) => {
      if (selectedMediaType.value === "movie") return r.media_type === "movie";
      if (selectedMediaType.value === "tv") return r.media_type === "tv";
      if (selectedMediaType.value === "video_game")
        return r.media_type === "video_game";
      if (selectedMediaType.value === "audiobook")
        return r.media_type === "audiobook";
      if (selectedMediaType.value === "podcast")
        return r.media_type === "podcast";
      if (selectedMediaType.value === "advertisement")
        return r.media_type === "advertisement";
      if (selectedMediaType.value === "toy") return r.media_type === "toy";
      return true;
    });
  } catch (err) {
    console.error(err);
  } finally {
    if (requestId === mediaSearchRequestId) mediaSearchLoading.value = false;
  }
}

async function selectMediaItem(item: any) {
  const requestId = ++creditsRequestId;
  const mediaType = selectedMediaType.value;
  selectedMedia.value = item;
  linkWorkStep.value = 3;

  const supportsCast = ["movie", "tv", "video_game"].includes(mediaType);
  if (supportsCast) {
    linkWorkCastLoading.value = true;
    try {
      const credits: any = await $fetch("/api/internal-media-credits", {
        params: { media_type: mediaType, media_id: item.id },
      });
      if (
        requestId !== creditsRequestId ||
        selectedMedia.value?.id !== item.id ||
        selectedMediaType.value !== mediaType
      )
        return;
      linkWorkCast.value = (credits.cast ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character ?? c.name,
        profile_path: c.profile_path ?? null,
      }));
    } catch (err) {
      console.error("Failed to load cast:", err);
      if (
        requestId === creditsRequestId &&
        selectedMedia.value?.id === item.id &&
        selectedMediaType.value === mediaType
      ) {
        linkWorkCast.value = [];
      }
    } finally {
      if (requestId === creditsRequestId) linkWorkCastLoading.value = false;
    }
  } else {
    linkWorkCast.value = [];
    linkWorkCastLoading.value = false;
  }
}

watch(selectedMediaType, () => {
  mediaSearchRequestId += 1;
  creditsRequestId += 1;
  mediaSearchResults.value = [];
  selectedMedia.value = null;
  linkWorkCast.value = [];
  mediaSearchLoading.value = false;
  linkWorkCastLoading.value = false;
});

async function submitWorkLink(opts: {
  actorId?: number;
  actorName?: string;
  characterName?: string;
}) {
  if (!selectedMedia.value) return;
  isSubmittingWorkLink.value = true;
  try {
    await $fetch("/api/link-voice-actor", {
      method: "POST",
      body: {
        voice_actor_id: numId,
        media_type: selectedMediaType.value,
        media_id: selectedMedia.value.id,
        actor_id: opts.actorId ?? 0,
        character_name: opts.characterName ?? "",
        performance: linkWorkPerformance.value,
        language: searchLanguage.value,
      },
    });
    showToast(
      `Linked to "${selectedMedia.value.title || selectedMedia.value.name}"`,
      "success",
    );
    const { data: refreshed } = await supabase
      .from("work")
      .select("*, dubbing_projects(id, content_id, content_type)")
      .eq("voice_actor_id", numId);
    if (refreshed) linkedWorks.value = refreshed;
    closeLinkWorkModal();
  } catch (err: any) {
    showToast(
      err?.data?.message || err?.message || "Failed to link work",
      "error",
    );
  } finally {
    isSubmittingWorkLink.value = false;
  }
}

async function createAndLink() {
  if (!createMediaName.value) return;
  creditsRequestId += 1;
  linkWorkCastLoading.value = false;
  isCreatingMedia.value = true;
  try {
    const result = await $fetch<any>("/api/internal-media-create", {
      method: "POST",
      body: {
        media_type: selectedMediaType.value,
        name: createMediaName.value,
        brand: createMediaBrand.value || undefined,
        manufacturer: createMediaBrand.value || undefined,
      },
    });
    if (result?.media) {
      selectedMedia.value = {
        ...result.media,
        media_type: selectedMediaType.value,
      };
      showCreateMedia.value = false;
      createMediaName.value = "";
      createMediaBrand.value = "";
      linkWorkStep.value = 3;
      linkWorkCast.value = [];
    }
  } catch (err: any) {
    showToast(
      err?.data?.message || err?.message || "Failed to create media",
      "error",
    );
  } finally {
    isCreatingMedia.value = false;
  }
}
</script>
