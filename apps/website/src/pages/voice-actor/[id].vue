<template>
  <div>
    <PersonSkeleton v-if="pending || loading" />

    <div
      v-else-if="voiceActor"
      class="bg-gray-50 dark:bg-[#1b1b1b] min-h-screen text-gray-900 dark:text-white"
    >
      <!-- Hero Section -->
      <div class="relative w-full h-[50vh] min-h-[400px] overflow-hidden">
        <div class="absolute inset-0">
          <NuxtImg
            v-if="profilePicture"
            :src="profilePicture"
            class="w-full h-full object-cover blur-3xl opacity-50 scale-110"
            alt="Backdrop"
            format="webp"
          />
          <div
            class="absolute inset-0 bg-gradient-to-t from-gray-50 dark:from-[#1b1b1b] to-transparent"
          ></div>
          <div class="absolute inset-0 bg-black/10 dark:bg-black/40"></div>
        </div>

        <div
          class="absolute bottom-0 left-0 w-full p-8 flex flex-col md:flex-row gap-6 items-end"
        >
          <div
            class="w-32 md:w-48 rounded-lg overflow-hidden shadow-xl aspect-[2/3] bg-gray-100 dark:bg-[#161616] border border-white/10 shrink-0"
          >
            <NuxtImg
              format="webp"
              v-if="profilePicture"
              :src="profilePicture"
              :alt="voiceActor.firstname + ' ' + voiceActor.lastname"
              class="object-cover w-full h-full"
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-[#161616] text-gray-400 text-6xl font-bold uppercase"
            >
              {{ voiceActor.firstname?.[0] }}{{ voiceActor.lastname?.[0] }}
            </div>
          </div>
          <div class="pb-4 max-w-3xl">
            <h1
              class="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white"
            >
              {{ voiceActor.firstname }} {{ voiceActor.lastname }}
            </h1>

            <div class="flex flex-wrap items-center gap-3 mt-4">
              <span
                v-if="voiceActor.nationality"
                class="text-gray-900 dark:text-gray-100 font-medium text-sm md:text-base bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg"
              >
                {{ voiceActor.nationality }}
              </span>
              <span
                v-if="voiceActor.date_of_birth"
                class="text-gray-900 dark:text-gray-100 font-medium text-sm md:text-base bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg"
              >
                Born: {{ new Date(voiceActor.date_of_birth).getFullYear() }}
              </span>
              <span
                v-if="voiceActor.years_active"
                class="text-gray-900 dark:text-gray-100 font-medium text-sm md:text-base bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg"
              >
                Active: {{ voiceActor.years_active }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Bar -->
      <div
        class="border-b border-gray-200 dark:border-[#2a2a2a] bg-white/95 dark:bg-[#161616]/95 backdrop-blur sticky top-0 z-10 shadow-sm"
      >
        <div
          class="w-full px-8 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <!-- Completeness Score -->
          <div v-if="user" class="flex items-center gap-4">
            <div class="relative w-8 h-8 flex-shrink-0">
              <svg
                class="w-full h-full transform -rotate-90"
                viewBox="0 0 36 36"
              >
                <path
                  class="text-gray-200 dark:text-[#2a2a2a]"
                  stroke-width="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  class="text-emerald-500 transition-all duration-1000 ease-out"
                  :stroke-dasharray="`${completenessScore}, 100`"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-currentColor
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div
                class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-900 dark:text-white"
              >
                {{ completenessScore }}%
              </div>
            </div>
          </div>
          <div v-else></div>

          <!-- Right side actions -->
          <div class="flex items-center flex-wrap gap-4">
            <NuxtLink
              v-if="isAdmin"
              :to="$localePath(`/voice-actor/${voiceActorId}/edit`)"
              class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span class="hidden sm:inline">Éditer</span>
            </NuxtLink>

            <button
              @click="isReportModalOpen = true"
              class="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
              title="Signaler cette fiche"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
                />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="w-full p-8">
        <!-- Bio -->
        <div class="mb-12 max-w-4xl" v-if="voiceActor.bio">
          <section>
            <h2 class="text-2xl font-bold mb-4">Biography</h2>
            <p
              class="text-gray-700 dark:text-gray-300 leading-relaxed text-lg whitespace-pre-wrap"
            >
              {{ voiceActor.bio }}
            </p>
          </section>
        </div>

        <!-- Studios -->
        <div v-if="workedStudios.length > 0" class="mb-12 max-w-4xl">
          <section>
            <h2 class="text-2xl font-bold mb-4">Studios</h2>
            <div class="flex flex-wrap gap-4">
              <NuxtLink
                v-for="studio in workedStudios"
                :key="studio.id"
                :to="$localePath(`/studio/${studio.id}`)"
                class="flex items-center gap-3 bg-white dark:bg-[#1d1d1d] border border-gray-200 dark:border-[#2a2a2a] rounded-xl p-3 hover:border-cyan-500 transition-colors shadow-sm"
              >
                <div
                  v-if="studio.logo_url"
                  class="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1 shrink-0 overflow-hidden"
                >
                  <NuxtImg
                    :src="studio.logo_url"
                    :alt="studio.name"
                    class="max-w-full max-h-full object-contain"
                  />
                </div>
                <div
                  v-else
                  class="w-10 h-10 bg-gray-100 dark:bg-[#2a2a2a] rounded-lg flex items-center justify-center shrink-0"
                >
                  <span class="text-gray-400 font-bold">{{
                    studio.name.charAt(0).toUpperCase()
                  }}</span>
                </div>
                <span class="font-semibold text-gray-900 dark:text-gray-100">{{
                  studio.name
                }}</span>
              </NuxtLink>
            </div>
          </section>
        </div>

        <!-- Filmography -->
        <section>
          <div class="flex flex-col mb-6 gap-2">
            <div
              class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4"
            >
              <div>
                <h2 class="text-2xl font-bold">Filmography</h2>
              </div>

              <div class="flex flex-wrap gap-4 items-center">
                <div class="relative w-full sm:w-64">
                  <SearchIcon
                    class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  />
                  <input
                    v-model="searchQuery"
                    type="search"
                    placeholder="Search roles, titles or actors..."
                    class="w-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-[#00E5FF] transition-all text-gray-900 dark:text-white"
                  />
                </div>

                <!-- Display Mode Toggle -->
                <div
                  class="flex bg-gray-100 dark:bg-[#161616] rounded-lg p-1 border border-gray-200 dark:border-[#2a2a2a]"
                >
                  <button
                    @click="displayMode = 'grouped'"
                    :class="[
                      'px-4 py-1.5 rounded-md text-sm font-medium transition',
                      displayMode === 'grouped'
                        ? 'bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                    ]"
                  >
                    Grouped
                  </button>
                  <button
                    @click="displayMode = 'list'"
                    :class="[
                      'px-4 py-1.5 rounded-md text-sm font-medium transition',
                      displayMode === 'list'
                        ? 'bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                    ]"
                  >
                    List
                  </button>
                </div>

                <!-- Sort Dropdown -->
                <select
                  v-model="sortMode"
                  class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] text-gray-900 dark:text-gray-200 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>
          </div>

          <div
            v-if="filteredEnhancedWork.length === 0"
            class="text-gray-500 text-center py-12 bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-[#2a2a2a]"
          >
            No works found for this actor.
          </div>

          <template v-if="displayMode === 'list'">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <NuxtLink
                :to="
                  $localePath(
                    `/${item.work.dubbing_projects?.content_type === 'tv' ? 'show' : 'movie'}/${item.media.id}`,
                  )
                "
                v-for="item in sortedWorks"
                :key="item.work.id"
                class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700 block group"
              >
                <div class="flex flex-col sm:grid sm:grid-cols-3 gap-4 h-full">
                  <!-- Column 1: Media -->
                  <div
                    class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start"
                  >
                    <div
                      class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 flex-shrink-0"
                    >
                      <NuxtImg
                        format="webp"
                        v-if="item.media.poster_path"
                        :src="resolveImageUrl(item.media.poster_path)"
                        :alt="
                          (item.media as any).title || (item.media as any).name
                        "
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div
                        v-else
                        class="w-full h-full flex items-center justify-center text-gray-400"
                      >
                        <ClapperboardIcon
                          class="w-6 h-6 sm:w-8 sm:h-8 opacity-20"
                        />
                      </div>
                    </div>
                    <div class="flex flex-col min-w-0 flex-1">
                      <span
                        class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5"
                        >{{ new Date(item.sortDate).getFullYear() }}</span
                      >
                      <span
                        class="font-bold text-sm text-gray-900 dark:text-gray-100 leading-tight line-clamp-2"
                        :title="
                          (item.media as any).title || (item.media as any).name
                        "
                        >{{
                          (item.media as any).title || (item.media as any).name
                        }}</span
                      >
                      <div
                        v-if="item.work.dubbing_projects?.studios"
                        class="mt-1 flex"
                      >
                        <span
                          class="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 rounded-md font-medium border border-gray-200 dark:border-gray-700 truncate"
                          :title="item.work.dubbing_projects.studios.name"
                        >
                          {{ item.work.dubbing_projects.studios.name }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Column 2: Original Actor -->
                  <div
                    class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-3 sm:pt-0"
                  >
                    <div
                      class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 flex-shrink-0"
                    >
                      <NuxtImg
                        format="webp"
                        v-if="item.data.actor.profile_picture"
                        :src="resolveImageUrl(item.data.actor.profile_picture)"
                        :alt="item.data.actor.name"
                        class="w-full h-full object-cover"
                      />
                      <div
                        v-else
                        class="w-full h-full flex items-center justify-center text-gray-400"
                      >
                        <UserIcon class="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                      </div>
                    </div>
                    <div class="flex flex-col min-w-0 flex-1">
                      <span
                        class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5"
                        >Voiced</span
                      >
                      <span
                        class="font-medium text-sm text-gray-700 dark:text-gray-300 leading-tight line-clamp-2"
                        >{{ item.data.actor.name }}</span
                      >
                    </div>
                  </div>

                  <!-- Column 3: Character -->
                  <div
                    class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-3 sm:pt-0"
                  >
                    <div
                      class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 relative flex-shrink-0"
                    >
                      <NuxtImg
                        format="webp"
                        v-if="item.data.characterImage"
                        :src="resolveImageUrl(item.data.characterImage)"
                        :alt="item.data.character"
                        class="w-full h-full object-cover"
                      />
                      <div
                        v-else
                        class="w-full h-full flex items-center justify-center text-gray-400"
                      >
                        <UserIcon class="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                      </div>
                      <div
                        v-if="item.work.performance"
                        class="absolute bottom-1 left-1 right-1 flex justify-center"
                      >
                        <span
                          class="bg-black/70 backdrop-blur text-white text-[9px] px-2 py-0.5 rounded-full truncate max-w-full font-medium"
                        >
                          {{
                            $te(`performance.${item.work.performance}`)
                              ? $t(`performance.${item.work.performance}`)
                              : item.work.performance
                          }}
                        </span>
                      </div>
                    </div>
                    <div class="flex flex-col min-w-0 flex-1">
                      <span
                        class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5"
                        >As</span
                      >
                      <span
                        class="font-medium text-sm text-gray-700 dark:text-gray-300 leading-tight line-clamp-2"
                        >{{ item.data.character || "Unknown" }}</span
                      >
                    </div>
                  </div>
                </div>
              </NuxtLink>
            </div>
          </template>
          <template v-else>
            <div class="space-y-10">
              <div
                v-for="[actorName, works] in groupedWorks"
                :key="actorName"
                class="space-y-4"
              >
                <!-- Actor Group Header -->
                <NuxtLink
                  :to="$localePath(`/actor/${works[0]?.data.actor.id}`)"
                  class="flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4 hover:bg-gray-50 dark:hover:bg-[#1d1d1d] p-2 -ml-2 rounded-xl transition-colors cursor-pointer group"
                >
                  <div
                    class="w-20 h-20 shrink-0 rounded-full overflow-hidden bg-gray-100 dark:bg-[#161616] shadow-md border border-gray-200 dark:border-[#2a2a2a]"
                  >
                    <NuxtImg
                      format="webp"
                      v-if="works[0]?.data.actor.profile_picture"
                      :src="
                        resolveImageUrl(works[0].data.actor.profile_picture)
                      "
                      :alt="actorName"
                      class="object-cover w-full h-full"
                    />
                    <UserIcon v-else class="w-full h-full text-gray-400 p-2" />
                  </div>
                  <div>
                    <h3
                      class="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:underline"
                    >
                      {{ actorName }}
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ works.length }} works
                    </p>
                  </div>
                </NuxtLink>

                <!-- Actor Works Grid -->
                <div
                  class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
                >
                  <NuxtLink
                    :to="
                      $localePath(
                        `/${item.work.dubbing_projects?.content_type === 'tv' ? 'show' : 'movie'}/${item.media.id}`,
                      )
                    "
                    v-for="item in works"
                    :key="item.work.id"
                    class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700 block group"
                  >
                    <div
                      class="flex flex-col sm:grid sm:grid-cols-2 gap-4 h-full"
                    >
                      <!-- Column 1: Media -->
                      <div
                        class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start"
                      >
                        <div
                          class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 flex-shrink-0"
                        >
                          <NuxtImg
                            format="webp"
                            v-if="item.media.poster_path"
                            :src="resolveImageUrl(item.media.poster_path)"
                            :alt="
                              (item.media as any).title ||
                              (item.media as any).name
                            "
                            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div
                            v-else
                            class="w-full h-full flex items-center justify-center text-gray-400"
                          >
                            <ClapperboardIcon class="w-6 h-6 opacity-20" />
                          </div>
                        </div>
                        <div class="flex flex-col min-w-0 flex-1">
                          <span
                            class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5"
                            >{{ new Date(item.sortDate).getFullYear() }}</span
                          >
                          <span
                            class="font-bold text-sm text-gray-900 dark:text-gray-100 leading-tight line-clamp-2"
                            :title="
                              (item.media as any).title ||
                              (item.media as any).name
                            "
                            >{{
                              (item.media as any).title ||
                              (item.media as any).name
                            }}</span
                          >
                          <div
                            v-if="item.work.dubbing_projects?.studios"
                            class="mt-1 flex"
                          >
                            <span
                              class="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 rounded-md font-medium border border-gray-200 dark:border-gray-700 truncate"
                              :title="item.work.dubbing_projects.studios.name"
                            >
                              {{ item.work.dubbing_projects.studios.name }}
                            </span>
                          </div>
                        </div>
                      </div>

                      <!-- Column 2: Character -->
                      <div
                        class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-3 sm:pt-0"
                      >
                        <div
                          class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 sm:mb-3 relative flex-shrink-0"
                        >
                          <NuxtImg
                            format="webp"
                            v-if="item.data.characterImage"
                            :src="resolveImageUrl(item.data.characterImage)"
                            :alt="item.data.character"
                            class="w-full h-full object-cover"
                          />
                          <div
                            v-else
                            class="w-full h-full flex items-center justify-center text-gray-400"
                          >
                            <UserIcon class="w-6 h-6 opacity-20" />
                          </div>
                          <div
                            v-if="item.work.performance"
                            class="absolute bottom-1 left-1 right-1 flex justify-center"
                          >
                            <span
                              class="bg-black/70 backdrop-blur text-white text-[9px] px-2 py-0.5 rounded-full truncate max-w-full font-medium"
                            >
                              {{
                                $te(`performance.${item.work.performance}`)
                                  ? $t(`performance.${item.work.performance}`)
                                  : item.work.performance
                              }}
                            </span>
                          </div>
                        </div>
                        <div class="flex flex-col min-w-0 flex-1">
                          <span
                            class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5"
                            >As</span
                          >
                          <span
                            class="font-medium text-sm text-gray-700 dark:text-gray-300 leading-tight line-clamp-2"
                            >{{ item.data.character || "Unknown" }}</span
                          >
                        </div>
                      </div>
                    </div>
                  </NuxtLink>
                </div>
              </div>
            </div>
          </template>
        </section>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-500">Actor not found.</div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import { useVoiceActorData, fetchVoiceActorData } from "@app/shared-logic";
import { useRouter, useRoute } from "vue-router";
import { ClapperboardIcon, UserIcon, SearchIcon } from "lucide-vue-next";
import ReportModal from "../../components/ReportModal.vue";
import { computed, ref, watch } from "vue";

const isReportModalOpen = ref(false);

const supabase = useSupabaseClient();
const router = useRouter();

const route = useRoute();
const voiceActorId = Number(route.params.id);
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);
const { locale, t } = useI18n();

const config = useRuntimeConfig();
const baseUrl = config.public.supabase.url;

const { data, pending } = useAsyncData(`voice-actor-${voiceActorId}`, () =>
  fetchVoiceActorData(supabase, voiceActorId),
);

const voiceActorData = useVoiceActorData(supabase, data.value);
const {
  voiceActor,
  profilePicture,
  loading,
  searchQuery,
  filteredEnhancedWork,
} = voiceActorData;

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return (
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin"
  );
});

const completenessScore = computed(() => {
  if (!voiceActor.value) return 0;
  let score = 0;
  if (voiceActor.value.firstname && voiceActor.value.lastname) score += 20;
  if (voiceActor.value.nationality) score += 20;
  if (voiceActor.value.date_of_birth) score += 20;
  if (voiceActor.value.bio) score += 20;
  if (profilePicture.value) score += 20;
  return score;
});

watch(
  data,
  (newData) => {
    if (newData) {
      voiceActorData.voiceActor.value = newData.voiceActor;
      voiceActorData.medias.value = newData.medias;
      voiceActorData.characterProfilePictures.value =
        newData.characterProfilePictures;
      voiceActorData.profilePicture.value = newData.profilePicture;
      voiceActorData.potentialWikipediaUrl.value =
        newData.potentialWikipediaUrl;
      voiceActorData.votes.value = newData.votes;
      voiceActorData.loading.value = false;
    }
  },
  { immediate: true },
);

const actorName = computed(() => {
  if (!voiceActor.value) return "";
  return (
    voiceActor.value.voice_actor_name ||
    `${voiceActor.value.firstname} ${voiceActor.value.lastname}`
  );
});

const canonicalUrl = computed(
  () => `https://dubbingbase.com/voice-actor/${voiceActorId}`,
);

const ogImageUrl = computed(() => {
  if (!voiceActorId) return "";
  return `${baseUrl}/functions/v1/og-image?type=voice-actor&id=${voiceActorId}`;
});
const actorDescription = computed(() => {
  if (!actorName.value)
    return t(
      "seo.voiceActorDescriptionFallback",
      "Fiche comédien(ne) de doublage.",
    );
  const workCount = voiceActor.value?.work?.length || 0;
  const desc = t("seo.voiceActorDescription", {
    name: actorName.value,
    workCount,
  });
  return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
});

// Complete SEO metadata & JSON-LD Structured Data using unhead
useHead({
  title: computed(() =>
    actorName.value
      ? t("seo.voiceActorTitle", { name: actorName.value })
      : t("seo.voiceActorTitleFallback", "Comédien(ne) de doublage"),
  ),
  meta: [
    {
      name: "description",
      content: actorDescription,
    },
    {
      name: "keywords",
      content: computed(() => {
        const name = actorName.value || "";
        if (!name) return t("home.meta.keywords");
        return t("seo.voiceActorKeywords", { name });
      }),
    },
    { name: "robots", content: "index, follow" },
    // Open Graph
    {
      property: "og:title",
      content: computed(() =>
        actorName.value
          ? t("seo.voiceActorTitle", { name: actorName.value })
          : t("seo.voiceActorTitleFallback", "Comédien(ne) de doublage"),
      ),
    },
    { property: "og:description", content: actorDescription },
    { property: "og:type", content: "profile" },
    {
      property: "og:locale",
      content: computed(() => {
        return locale.value === "fr" ? "fr_FR" : "en_US";
      }),
    },
    { property: "og:logo", content: "https://dubbingbase.com/logo.png" },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: ogImageUrl },
    { property: "og:site_name", content: "DubbingBase" },
    // Twitter Card
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:title",
      content: computed(() =>
        actorName.value
          ? t("seo.voiceActorTitle", { name: actorName.value })
          : t("seo.voiceActorTitleFallback", "Comédien(ne) de doublage"),
      ),
    },
    { name: "twitter:description", content: actorDescription },
    { name: "twitter:image", content: ogImageUrl },
  ],
  link: [{ rel: "canonical", href: canonicalUrl }],
  script: [
    {
      type: "application/ld+json",
      innerHTML: computed(() => {
        const json = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: canonicalUrl.value,
          name: actorName.value
            ? `${actorName.value} - Fiche Comédien`
            : "Fiche Comédien",
          mainEntity: {
            "@type": "Person",
            name:
              actorName.value ||
              t("seo.voiceActorTitleFallback", "Comédien(ne) de doublage"),
            jobTitle: t(
              "seo.voiceActorTitleFallback",
              "Comédien(ne) de doublage",
            ),
            image: profilePicture.value || ogImageUrl.value,
            url: canonicalUrl.value,
          },
        });
        return json
          .replace(/</g, "\\u003c")
          .replace(/>/g, "\\u003e")
          .replace(/&/g, "\\u0026");
      }),
    },
  ],
});

const displayMode = ref<"grouped" | "list">("grouped");
const sortMode = ref<"newest" | "oldest">("newest");

const workedStudios = computed(() => {
  const studiosMap = new Map<
    number,
    { id: number; name: string; logo_url: string | null }
  >();
  for (const item of filteredEnhancedWork.value) {
    const studio = item.work.dubbing_projects?.studios;
    if (studio && !studiosMap.has(studio.id)) {
      studiosMap.set(studio.id, studio);
    }
  }
  return Array.from(studiosMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
});

const resolveImageUrl = (path: string | undefined | null) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w185${path}`;
};

const sortedWorks = computed(() => {
  const works = [...filteredEnhancedWork.value];
  if (sortMode.value === "oldest") {
    return works.sort((a, b) => (a.sortDate > b.sortDate ? 1 : -1));
  }
  return works.sort((a, b) => (a.sortDate > b.sortDate ? -1 : 1));
});

const groupedWorks = computed(() => {
  const map = new Map<string, typeof sortedWorks.value>();
  for (const item of sortedWorks.value) {
    const actorName = item.data.actor.name || "Unknown Actor";
    if (!map.has(actorName)) {
      map.set(actorName, []);
    }
    map.get(actorName)!.push(item);
  }

  return Array.from(map.entries()).sort((a, b) => {
    // Sort by number of works, then alphabetically
    if (b[1].length !== a[1].length) {
      return b[1].length - a[1].length;
    }
    return a[0].localeCompare(b[0]);
  });
});
</script>
