<template>
  <div class="space-y-6">
    <!-- Header Card -->
    <div
      class="theme-surface-overlay p-6 rounded-2xl border theme-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <h3 class="text-lg font-bold theme-text">
          {{ $t("admin.queue.title") }}
        </h3>
        <p class="text-sm theme-text-muted">
          {{ $t("admin.queue.description") }}
        </p>
        <p
          v-if="pendingCount !== null"
          class="text-xs theme-status-warning-text mt-1"
        >
          {{ $t("admin.queue.pendingCount", { count: pendingCount }) }}
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <button
          v-if="isDev"
          @click="clearQueue"
          :disabled="isClearing || isLoading"
          class="py-2.5 px-5 bg-red-600 hover:bg-red-500 disabled:bg-[var(--app-color-surface-muted)] disabled:text-[var(--app-color-text-muted)] text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
        >
          <span
            v-if="isClearing"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></span>
          <span>{{ $t("admin.queue.clearQueue") }}</span>
        </button>
        <button
          @click="startProcessing"
          :disabled="isProcessing || isLoading"
          class="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-[var(--app-color-surface-muted)] disabled:text-[var(--app-color-text-muted)] text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
        >
          <span
            v-if="isProcessing"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></span>
          <span>{{ $t("admin.queue.startProcessing") }}</span>
        </button>
        <button
          @click="() => fetchQueueAndUsers()"
          :disabled="isLoading"
          class="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-[var(--app-color-surface-muted)] disabled:text-[var(--app-color-text-muted)] text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
        >
          <span
            v-if="isLoading"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></span>
          <span>{{ $t("admin.queue.refreshQueue") }}</span>
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="p-4 theme-status-danger border border-[var(--app-color-danger-border)] rounded-xl flex items-center space-x-3 theme-status-danger-text text-sm"
    >
      <svg
        class="h-5 w-5 theme-status-danger-text shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Queue Loading State -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center py-24 space-y-3 theme-surface-overlay border theme-border rounded-2xl"
    >
      <div
        class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"
      ></div>
      <p class="theme-text-muted text-sm">
        {{ $t("admin.queue.loadingQueue") }}
      </p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="allQueueItems.length === 0"
      class="text-center py-20 theme-surface-overlay border theme-border rounded-2xl space-y-2"
    >
      <div
        class="h-12 w-12 rounded-full theme-surface-overlay flex items-center justify-center theme-text-muted mx-auto"
      >
        <svg
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p class="theme-text-muted font-semibold">
        {{ $t("admin.queue.noMediaRequests") }}
      </p>
      <p class="text-xs theme-text-muted">{{ $t("admin.queue.queueEmpty") }}</p>
    </div>

    <!-- Queue Content (Filters + Table) -->
    <div v-else class="space-y-6">
      <!-- Filters -->
      <div
        class="flex flex-wrap items-center gap-3 theme-surface-overlay p-4 rounded-2xl border theme-border"
      >
        <!-- Archive / Active Toggle -->
        <div
          class="flex items-center theme-input p-1 rounded-xl border theme-border"
        >
          <button
            type="button"
            @click="archiveFilter = 'active'"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center space-x-1.5"
            :class="
              archiveFilter === 'active'
                ? 'theme-primary-bg shadow-md'
                : 'theme-text-muted theme-hover-text'
            "
          >
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{{ $t("admin.queue.active") }} ({{ activeCount }})</span>
          </button>
          <button
            type="button"
            @click="archiveFilter = 'archived'"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center space-x-1.5"
            :class="
              archiveFilter === 'archived'
                ? 'theme-primary-bg shadow-md'
                : 'theme-text-muted theme-hover-text'
            "
          >
            <span class="w-2 h-2 rounded-full theme-surface-muted"></span>
            <span>{{ $t("admin.queue.archived") }} ({{ archivedCount }})</span>
          </button>
          <button
            type="button"
            @click="archiveFilter = 'all'"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150"
            :class="
              archiveFilter === 'all'
                ? 'theme-primary-bg shadow-md'
                : 'theme-text-muted theme-hover-text'
            "
          >
            {{ $t("admin.queue.all") }} ({{ allQueueItems.length }})
          </button>
        </div>

        <div class="h-6 w-px theme-surface-muted hidden sm:block"></div>

        <div class="flex items-center space-x-2">
          <label class="text-xs theme-text-muted font-semibold uppercase">{{
            $t("admin.queue.queue")
          }}</label>
          <select
            v-model="filterQueue"
            class="theme-surface-muted border theme-border theme-text text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-[var(--app-color-focus)] focus:border-[var(--app-color-focus)]"
          >
            <option value="all">{{ $t("admin.queue.allQueues") }}</option>
            <option value="wiki_extract">
              {{ $t("admin.queue.llmExtractionReady") }}
            </option>
            <option value="wiki_check">
              {{ $t("admin.queue.tocSectionCheck") }}
            </option>
            <option value="wiki_discovery">
              {{ $t("admin.queue.wikidataDiscovery") }}
            </option>
          </select>
        </div>
        <div class="flex items-center space-x-2">
          <label class="text-xs theme-text-muted font-semibold uppercase">{{
            $t("admin.queue.status")
          }}</label>
          <select
            v-model="filterStatus"
            class="theme-surface-muted border theme-border theme-text text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-[var(--app-color-focus)] focus:border-[var(--app-color-focus)]"
          >
            <option value="all">{{ $t("admin.queue.all") }}</option>
            <option value="pending">{{ $t("admin.queue.pending") }}</option>
            <option value="processing">
              {{ $t("admin.queue.processing") }}
            </option>
            <option value="completed">{{ $t("admin.queue.completed") }}</option>
            <option value="failed">{{ $t("admin.queue.failed") }}</option>
          </select>
        </div>
        <div class="flex items-center space-x-2">
          <label class="text-xs theme-text-muted font-semibold uppercase">{{
            $t("admin.queue.type")
          }}</label>
          <select
            v-model="filterType"
            class="theme-surface-muted border theme-border theme-text text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-[var(--app-color-focus)] focus:border-[var(--app-color-focus)]"
          >
            <option value="all">{{ $t("admin.queue.all") }}</option>
            <option value="movie">{{ $t("admin.queue.movie") }}</option>
            <option value="tv">{{ $t("admin.queue.tv") }}</option>
            <option value="season">{{ $t("admin.queue.season") }}</option>
            <option value="episode">{{ $t("admin.queue.episode") }}</option>
            <option value="video_game">{{ $t("admin.queue.typeGame") }}</option>
            <option value="audiobook">{{ $t("audiobook.title") }}</option>
            <option value="podcast">{{ $t("admin.queue.typePodcast") }}</option>
            <option value="advertisement">
              {{ $t("admin.queue.typeAdvertisement") }}
            </option>
            <option value="toy">{{ $t("admin.queue.typeToy") }}</option>
          </select>
        </div>
        <div class="flex items-center space-x-2">
          <label class="text-xs theme-text-muted font-semibold uppercase">{{
            $t("admin.queue.search")
          }}</label>
          <input
            v-model="filterSearch"
            type="text"
            :placeholder="$t('admin.queue.searchPlaceholder')"
            class="theme-surface-muted border theme-border theme-text text-xs rounded-lg px-3 py-1.5 w-32 focus:ring-1 focus:ring-[var(--app-color-focus)] focus:border-[var(--app-color-focus)]"
          />
        </div>
        <span class="text-xs theme-text-muted ml-auto">
          {{
            $t("admin.queue.filterCount", {
              filtered: filteredItems.length,
              total: allQueueItems.length,
            })
          }}
        </span>
      </div>

      <!-- Queue Grid / Table -->
      <div
        class="theme-surface-overlay border theme-border rounded-2xl overflow-hidden shadow-xl"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr
                class="theme-surface-overlay border-b theme-border text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >
                <th class="py-4 px-6">{{ $t("admin.queue.mediaDetails") }}</th>
                <th class="py-4 px-6">{{ $t("admin.queue.appLink") }}</th>
                <th class="py-4 px-6">{{ $t("admin.queue.requestedBy") }}</th>
                <th class="py-4 px-6">{{ $t("common.status") }}</th>
                <th class="py-4 px-6">{{ $t("admin.queue.errors") }}</th>
                <th class="py-4 px-6 w-16 text-right">
                  {{ $t("common.actions") }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y theme-divide">
              <tr v-if="filteredItems.length === 0">
                <td colspan="6" class="py-8 text-center theme-text-muted">
                  {{ $t("admin.queue.noMatchingItems") }}
                </td>
              </tr>
              <tr
                v-for="item in filteredItems"
                :key="item.id"
                class="theme-hover-surface-muted transition-colors"
              >
                <!-- Media details column -->
                <td class="py-4 px-6">
                  <div class="flex items-center space-x-2">
                    <span
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border"
                      :class="getTypeClass(item.media_type)"
                    >
                      {{ item.media_type }}
                    </span>
                    <span
                      v-if="(item as any).queue_name === 'wiki_extract'"
                      class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase theme-status-info border"
                      >{{ $t("admin.queue.llmReady") }}</span
                    >
                    <span
                      v-else-if="(item as any).queue_name === 'wiki_check'"
                      class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase theme-status-info border"
                      >{{ $t("admin.queue.tocCheck") }}</span
                    >
                    <span
                      v-else-if="(item as any).queue_name === 'wiki_discovery'"
                      class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase theme-status-warning border"
                      >{{ $t("admin.queue.discovery") }}</span
                    >
                    <span
                      v-if="item.wikipedia_language"
                      class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase theme-status-info border"
                    >
                      {{ $t("admin.wikipediaLanguage") }}:
                      {{ item.wikipedia_language }}
                    </span>
                    <span
                      v-if="item.dubbing_language"
                      class="px-2 py-0.5 rounded-full text-[10px] font-extrabold theme-status-info border"
                    >
                      {{ $t("admin.regionalDubbingLanguage") }}:
                      {{ item.dubbing_language }}
                    </span>
                    <span
                      v-if="(item as any).is_manual"
                      class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-950/60 border border-rose-800/80 theme-status-danger-text flex items-center space-x-1"
                      title="Enqueued manually (top priority)"
                    >
                      <span>{{ $t("admin.queue.priority") }}</span>
                    </span>
                    <div class="flex items-center space-x-3">
                      <a
                        :href="`https://www.themoviedb.org/${item.media_type === 'tv' || item.media_type === 'season' || item.media_type === 'episode' ? 'tv' : 'movie'}/${item.tmdb_id}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs font-semibold theme-status-info-text hover:text-[var(--app-color-info-text)] hover:underline flex items-center"
                        :title="$t('admin.queue.viewOnTmdb')"
                      >
                        <span
                          >{{ $t("common.tmdbLabel") }}{{ item.tmdb_id }}</span
                        >
                        <svg
                          class="w-3 h-3 ml-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          ></path>
                        </svg>
                      </a>
                      <a
                        :href="`https://hub.toolforge.org/${item.media_type === 'tv' || item.media_type === 'season' || item.media_type === 'episode' ? 'P4983' : 'P4947'}:${item.tmdb_id}?lang=${item.wikipedia_language || 'fr'}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs font-semibold theme-text-muted theme-hover-text hover:underline flex items-center"
                        :title="$t('admin.queue.viewOnWikipedia')"
                      >
                        <span>{{ $t("admin.queue.wikipedia") }}</span>
                        <svg
                          class="w-3 h-3 ml-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          ></path>
                        </svg>
                      </a>
                    </div>
                  </div>
                  <div class="mt-1 flex items-center space-x-2">
                    <span
                      v-if="
                        item.season_number !== null &&
                        item.season_number !== undefined
                      "
                      class="text-xs px-2 py-0.5 theme-input border theme-border theme-text-secondary rounded font-bold"
                    >
                      {{
                        $t("admin.queue.seasonNumber", {
                          number: item.season_number,
                        })
                      }}
                    </span>
                    <span
                      v-if="
                        item.episode_number !== null &&
                        item.episode_number !== undefined
                      "
                      class="text-xs px-2 py-0.5 theme-input border theme-border theme-text-secondary rounded font-bold"
                    >
                      {{
                        $t("admin.queue.episodeNumber", {
                          number: item.episode_number,
                        })
                      }}
                    </span>
                  </div>
                </td>

                <!-- App Link column -->
                <td class="py-4 px-6 whitespace-nowrap">
                  <NuxtLink
                    :to="getAppMediaUrl(item)"
                    target="_blank"
                    class="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg theme-status-info hover:bg-[var(--app-color-info-bg)] theme-status-info-text hover:text-[var(--app-color-info-text)] border border-[var(--app-color-info-border)] text-xs font-semibold transition-all duration-150 group shadow-sm"
                  >
                    <span>{{ $t("admin.queue.openInApp") }}</span>
                    <svg
                      class="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </NuxtLink>
                </td>

                <!-- Requester column -->
                <td class="py-4 px-6">
                  <div class="font-medium theme-text text-sm truncate max-w-xs">
                    {{ getUserEmail(getQueueRequesterId(item)) }}
                  </div>
                  <div class="text-xs theme-text-muted mt-0.5">
                    {{ formatTime(item.created_at) }}
                  </div>
                </td>

                <!-- Status column -->
                <td class="py-4 px-6">
                  <div class="flex items-center space-x-2">
                    <span
                      class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border flex items-center space-x-1.5"
                      :class="getStatusClass(item.status)"
                    >
                      <span
                        v-if="item.status === 'processing'"
                        class="h-2 w-2 rounded-full bg-blue-400 animate-pulse"
                      ></span>
                      <span>{{ item.status }}</span>
                    </span>
                  </div>
                </td>

                <!-- Errors column -->
                <td class="py-4 px-6">
                  <div
                    v-if="item.error_message"
                    class="text-xs theme-status-danger-text max-w-sm leading-relaxed theme-status-danger border border-[var(--app-color-danger-border)] rounded-xl p-2.5 font-mono"
                  >
                    <div class="line-clamp-2">{{ item.error_message }}</div>
                    <a
                      v-if="extractUrl(item.error_message)"
                      :href="extractUrl(item.error_message)!"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="mt-1.5 inline-flex items-center theme-status-info-text hover:text-[var(--app-color-info-text)] hover:underline text-[11px] font-sans font-medium"
                    >
                      <span>{{
                        extractUrl(item.error_message)?.includes("wikidata.org")
                          ? $t("admin.queue.openWikidata")
                          : $t("admin.queue.viewOnWikipedia")
                      }}</span>
                      <svg
                        class="w-3 h-3 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        ></path>
                      </svg>
                    </a>
                  </div>
                  <div v-else class="text-xs theme-text-muted italic">—</div>
                </td>

                <!-- Actions column -->
                <td class="py-4 px-6 text-right">
                  <div class="flex items-center justify-end space-x-1">
                    <button
                      v-if="
                        item.status === 'failed' || item.status === 'completed'
                      "
                      @click="reEnqueueItem(item)"
                      :disabled="
                        reEnqueuingId === item.id || deletingId === item.id
                      "
                      :title="$t('admin.queue.reEnqueueItem')"
                      class="p-2 theme-text-muted hover:text-[var(--app-color-info-text)] hover:bg-[var(--app-color-info-bg)] rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg
                        v-if="reEnqueuingId === item.id"
                        class="w-4 h-4 animate-spin theme-status-info-text"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <svg
                        v-else
                        class="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                    <button
                      @click="deleteItem(item.id, (item as any).queue_name)"
                      :disabled="
                        deletingId === item.id || reEnqueuingId === item.id
                      "
                      :title="$t('admin.queue.deleteItem')"
                      class="p-2 theme-text-muted hover:text-[var(--app-color-danger-text)] hover:bg-[var(--app-color-danger-bg)] rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg
                        v-if="deletingId === item.id"
                        class="w-4 h-4 animate-spin theme-status-danger-text"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <svg
                        v-else
                        class="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Toast Notifications -->
    <div
      v-if="toast.show"
      class="fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl text-sm max-w-sm flex items-center space-x-3"
      :class="
        toast.type === 'success'
          ? 'theme-status-success border-[var(--app-color-success-border)] theme-status-success-text'
          : toast.type === 'error'
            ? 'theme-status-danger border-[var(--app-color-danger-border)] theme-status-danger-text'
            : 'theme-surface-overlay theme-border theme-text'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Database } from "@app/supabase";

type QueueItem =
  Database["public"]["Functions"]["get_media_queue_items"]["Returns"][number];

interface ListUsersResponse {
  users?: Array<{ id: string; email: string }>;
}

interface ToastState {
  show: boolean;
  message: string;
  type: "success" | "error" | "info";
}

const supabase = useSupabaseClient<Database>();
const { t } = useI18n();

definePageMeta({
  layout: "admin",
  middleware: "admin",
});

const queueItems = ref<QueueItem[]>([]);
const usersMap = ref<Record<string, string>>({});
const isLoading = ref(true);
const isProcessing = ref(false);
const isClearing = ref(false);
const deletingId = ref<number | null>(null);
const reEnqueuingId = ref<number | null>(null);
const error = ref("");
const isDev = import.meta.env.DEV;
const pendingCount = ref<number | null>(null);

const filterQueue = ref("all");
const filterStatus = ref("all");
const filterType = ref("all");
const filterSearch = ref("");
const archiveFilter = ref<"active" | "archived" | "all">("active");

const activeCount = ref(0);
const archivedCount = ref(0);

const allQueueItems = computed(() => queueItems.value);

const filteredItems = computed(() => {
  return allQueueItems.value.filter((item) => {
    if (filterType.value !== "all" && item.media_type !== filterType.value) {
      return false;
    }
    if (
      filterSearch.value &&
      !String(item.tmdb_id).includes(filterSearch.value)
    ) {
      return false;
    }
    return true;
  });
});

const toast = ref<ToastState>({
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

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

const getStatusClass = (status: string) => {
  switch (status) {
    case "completed":
      return "theme-status-success";
    case "processing":
      return "theme-status-info";
    case "pending":
      return "theme-status-warning";
    case "failed":
    case "error":
      return "theme-status-danger";
    default:
      return "theme-surface-muted theme-border theme-text-muted";
  }
};

const getTypeClass = (type: string) => {
  switch (type) {
    case "movie":
      return "theme-status-info";
    case "tv":
      return "theme-status-info";
    case "season":
      return "theme-status-info";
    case "episode":
      return "theme-status-info";
    case "video_game":
    case "game":
      return "theme-status-info";
    case "audiobook":
      return "theme-status-info";
    case "podcast":
      return "theme-status-info";
    case "advertisement":
      return "theme-status-info";
    case "toy":
      return "theme-status-info";
    default:
      return "theme-surface-muted theme-border theme-text-muted";
  }
};

const getAppMediaUrl = (item: any): string => {
  const tmdbId = item.tmdb_id;
  const mediaType = item.media_type;
  const season = item.season_number;
  const episode = item.episode_number;

  switch (mediaType) {
    case "movie":
      return `/movie/${tmdbId}`;
    case "tv":
      if (
        season !== null &&
        season !== undefined &&
        episode !== null &&
        episode !== undefined
      ) {
        return `/show/${tmdbId}/season/${season}/episode/${episode}`;
      }
      if (season !== null && season !== undefined) {
        return `/show/${tmdbId}/season/${season}`;
      }
      return `/show/${tmdbId}`;
    case "season":
      if (season !== null && season !== undefined) {
        return `/show/${tmdbId}/season/${season}`;
      }
      return `/show/${tmdbId}`;
    case "episode":
      if (
        season !== null &&
        season !== undefined &&
        episode !== null &&
        episode !== undefined
      ) {
        return `/show/${tmdbId}/season/${season}/episode/${episode}`;
      }
      return `/show/${tmdbId}`;
    case "video_game":
    case "game":
      return `/game/${tmdbId}`;
    case "audiobook":
      return `/audiobook/${tmdbId}`;
    case "podcast":
      return `/podcast/${tmdbId}`;
    case "advertisement":
      return `/advertisement/${tmdbId}`;
    case "toy":
      return `/toy/${tmdbId}`;
    default:
      return `/movie/${tmdbId}`;
  }
};

function getQueueRequesterId(item: QueueItem): string | undefined {
  return "user_id" in item && typeof item.user_id === "string"
    ? item.user_id
    : undefined;
}

const getUserEmail = (userId: string | null | undefined) => {
  if (!userId) return "Anonymous";
  return usersMap.value[userId] || `User (${userId.substring(0, 8)})`;
};

const extractUrl = (text: string | null | undefined): string | null => {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s)\]]+/i);
  return match ? match[0] : null;
};

// Pure JS relative time formatter
const formatTime = (timeStr: string) => {
  try {
    const past = new Date(timeStr).getTime();
    const now = Date.now();
    const diffSecs = Math.floor((now - past) / 1000);

    if (diffSecs < 60) return "Just now";
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return timeStr;
  }
};

const {
  data: initialData,
  pending,
  error: fetchError,
  refresh: fetchQueueAndUsers,
} = await useAsyncData(
  "admin-queue",
  async () => {
    const statusParam =
      archiveFilter.value !== "all"
        ? filterStatus.value !== "all"
          ? filterStatus.value
          : archiveFilter.value
        : filterStatus.value !== "all"
          ? filterStatus.value
          : null;

    const queueParam = filterQueue.value !== "all" ? filterQueue.value : null;

    const [queueRes, statsRes, userData] = await Promise.all([
      (supabase.rpc as any)("get_media_queue_items", {
        p_queue_name: queueParam,
        p_status: statusParam,
        p_limit: 100,
      }),
      (supabase.rpc as any)("get_media_queue_stats"),
      $fetch<ListUsersResponse>("/api/list_users").catch(() => null),
    ]);

    if (queueRes.error) throw queueRes.error;

    const map: Record<string, string> = {};
    if (userData?.users) {
      for (const u of userData.users) {
        map[u.id] = u.email;
      }
    }

    const stats = statsRes.data as any;
    const activeTotal = stats?.totals?.total_active ?? 0;
    const archivedTotal =
      (stats?.totals?.completed ?? 0) + (stats?.totals?.error ?? 0);

    return {
      queueItems: queueRes.data ?? [],
      usersMap: map,
      activeTotal,
      archivedTotal,
      pendingCount: activeTotal,
    };
  },
  {
    watch: [archiveFilter, filterQueue, filterStatus],
  },
);

watch(
  initialData,
  (newData) => {
    if (newData) {
      queueItems.value = newData.queueItems;
      usersMap.value = newData.usersMap;
      pendingCount.value = newData.pendingCount;
      activeCount.value = newData.activeTotal;
      archivedCount.value = newData.archivedTotal;
    }
  },
  { immediate: true },
);

watch(
  pending,
  (val) => {
    isLoading.value = val;
  },
  { immediate: true },
);

watch(
  fetchError,
  (err) => {
    if (err) {
      error.value = err.message || "Failed to load queue data.";
      console.error("Error fetching queue or users:", err);
    } else {
      error.value = "";
    }
  },
  { immediate: true },
);

const startProcessing = async () => {
  isProcessing.value = true;
  showToast(t("admin.queue.processingStarted"), "info");
  try {
    const res = await $fetch<{
      ok: boolean;
      processed: number;
      reason?: string;
      message?: string;
      results?: Array<{
        id: number;
        ok: boolean;
        error?: string;
        changes?: number;
        creditsAdded?: number;
      }>;
    }>("/api/process-media-queue", {
      method: "POST",
      body: {
        queue: filterQueue.value !== "all" ? filterQueue.value : undefined,
      },
    });

    if (res.results && res.results.length > 0 && !res.results[0]?.ok) {
      showToast(
        res.results[0]?.error || t("admin.queue.failedToProcess"),
        "error",
      );
    } else if (res.processed > 0) {
      const result = res.results?.[0];
      const detail = result ? ` (+${result.creditsAdded ?? 0} credits)` : "";
      showToast(`${t("admin.queue.processingCompleted")}${detail}`, "success");
    } else {
      showToast(res.message || "No pending items to process", "info");
    }
  } catch (err: unknown) {
    console.error("Error processing queue:", err);
    showToast(getErrorMessage(err, t("admin.queue.failedToProcess")), "error");
  } finally {
    isProcessing.value = false;
    await fetchQueueAndUsers();
  }
};

const clearQueue = async () => {
  if (
    !confirm(
      "Are you sure you want to completely clear the queue? This will delete all pending and archived items.",
    )
  )
    return;

  isClearing.value = true;
  showToast(t("admin.queue.clearingQueue"), "info");

  try {
    await $fetch("/api/admin/queue/clear", { method: "POST" });
    showToast(t("admin.queue.cleared"), "success");
  } catch (err: unknown) {
    console.error("Error clearing queue:", err);
    showToast(getErrorMessage(err, t("admin.queue.failedToClear")), "error");
  } finally {
    isClearing.value = false;
    await fetchQueueAndUsers();
  }
};

const deleteItem = async (id: number, queueName?: string) => {
  if (!confirm(t("admin.queue.confirmDelete"))) return;

  deletingId.value = id;
  try {
    await $fetch("/api/admin/queue/item", {
      method: "DELETE",
      body: { id, queueName },
    });
    showToast(t("admin.queue.itemDeleted"), "success");
    await fetchQueueAndUsers();
  } catch (err: unknown) {
    console.error("Error deleting item:", err);
    showToast(getErrorMessage(err, t("admin.queue.failedToDelete")), "error");
  } finally {
    deletingId.value = null;
  }
};

const reEnqueueItem = async (item: QueueItem) => {
  if (!confirm(t("admin.queue.confirmReEnqueue"))) return;

  reEnqueuingId.value = item.id;
  try {
    const queueName = item.queue_name;

    const enqueueResult = await $fetch<{
      alreadyQueued?: boolean;
      message?: string;
    }>("/api/media-queue", {
      method: "POST",
      body: {
        action: "enqueue",
        mediaId: item.tmdb_id,
        tmdbId: item.tmdb_id,
        mediaType: item.media_type,
        seasonNumber: item.season_number ?? undefined,
        episodeNumber: item.episode_number ?? undefined,
        language: item.wikipedia_language ?? item.language ?? undefined,
        wikipedia_language:
          item.wikipedia_language ?? item.language ?? undefined,
        dubbing_language: item.dubbing_language ?? undefined,
      },
    });

    if (enqueueResult.alreadyQueued) {
      if (enqueueResult.message) showToast(enqueueResult.message, "info");
    } else {
      try {
        await $fetch("/api/admin/queue/item", {
          method: "DELETE",
          body: {
            id: item.id,
            queueName,
          },
        });
      } catch (deleteError: unknown) {
        console.warn("Failed to delete old archived item:", deleteError);
      }

      showToast(t("admin.queue.reEnqueued"), "success");
    }

    await fetchQueueAndUsers();
  } catch (err: unknown) {
    console.error("Error re-enqueuing item:", err);
    showToast(
      getErrorMessage(err, t("admin.queue.failedToReEnqueue")),
      "error",
    );
  } finally {
    reEnqueuingId.value = null;
  }
};
</script>
