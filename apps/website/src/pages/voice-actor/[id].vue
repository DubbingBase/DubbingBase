<template>
  <div class="min-h-screen">
    <PersonSkeleton v-if="pending || loading" />

    <PersonDetailsLayout
      v-else-if="voiceActor"
      :name="voiceActor.firstname + ' ' + voiceActor.lastname"
      :profile-url="profilePicture"
      :backdrop-url="backdropPath"
      :loading="false"
    >
      <template #metadata>
        <span
          v-if="voiceActor.nationality"
          class="theme-text font-medium text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1.5 rounded-lg"
        >
          {{ voiceActor.nationality }}
        </span>
        <span
          v-if="voiceActor.date_of_birth"
          class="theme-text font-medium text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1.5 rounded-lg"
          >{{ $t("common.born") }}{{ voiceActor.date_of_birth.split("-")[0] }}
        </span>
        <span
          v-if="voiceActor.years_active"
          class="theme-text font-medium text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1.5 rounded-lg"
          >{{ $t("voiceActor.active") }}{{ voiceActor.years_active }}
        </span>
      </template>

      <template #biography>
        <div class="mb-12 max-w-4xl" v-if="voiceActor.bio">
          <section>
            <h2 class="text-2xl font-bold mb-4">
              {{ $t("profile.biography") }}
            </h2>
            <p
              class="theme-text-secondary leading-relaxed text-lg whitespace-pre-wrap"
            >
              {{ voiceActor.bio }}
            </p>
          </section>
        </div>
      </template>

      <template #actions>
        <!-- Completeness Score -->
        <div v-if="user" class="flex items-center gap-4">
          <div class="relative w-8 h-8 flex-shrink-0">
            <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                class="theme-text-muted"
                stroke-width="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                class="theme-status-success-text transition-all duration-1000 ease-out"
                :stroke-dasharray="`${completenessScore}, 100`"
                stroke-width="3"
                stroke-linecap="round"
                stroke-currentColor
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div
              class="absolute inset-0 flex items-center justify-center text-[9px] font-bold theme-text"
            >
              {{ completenessScore }}%
            </div>
          </div>
        </div>

        <NuxtLink
          v-if="isAdmin"
          :to="localePath(`/voice-actor/${voiceActorId}/edit`)"
          class="text-sm theme-primary-text theme-hover-primary-text transition-colors flex items-center gap-1.5 font-medium"
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
          <span class="hidden sm:inline">{{ $t("common.edit") }}</span>
        </NuxtLink>

        <button
          @click="isReportModalOpen = true"
          class="text-sm theme-text-muted theme-hover-danger-text transition-colors flex items-center gap-1.5"
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
      </template>

      <template #content>
        <!-- Studios -->
        <div v-if="workedStudios.length > 0" class="mb-12 max-w-4xl">
          <section>
            <h2 class="text-2xl font-bold mb-4">{{ $t("footer.studios") }}</h2>
            <div class="flex flex-wrap gap-4">
              <NuxtLink
                v-for="studio in workedStudios"
                :key="studio.id"
                :to="localePath(`/studio/${studio.id}`)"
                class="flex items-center gap-3 theme-surface border theme-border-subtle theme-border rounded-xl p-3 theme-hover-primary-border transition-colors shadow-sm"
              >
                <div
                  v-if="studio.logo_url"
                  class="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1 shrink-0 overflow-hidden"
                >
                  <NuxtImg
                    :src="studio.logo_url"
                    :alt="studio.name"
                    decoding="async"
                    class="max-w-full max-h-full object-contain"
                  />
                </div>
                <div
                  v-else
                  class="w-10 h-10 theme-surface-raised theme-surface-muted rounded-lg flex items-center justify-center shrink-0"
                >
                  <span class="theme-text-muted font-bold">{{
                    studio.name?.charAt(0)?.toUpperCase() || ""
                  }}</span>
                </div>
                <span class="font-semibold theme-text">{{ studio.name }}</span>
              </NuxtLink>
            </div>
          </section>
        </div>

        <!-- Filmography -->
        <section>
          <div class="flex flex-col mb-6 gap-4">
            <div
              class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4"
            >
              <div>
                <h2 class="text-2xl font-bold">
                  {{ $t("voiceActor.filmography", "Filmography") }}
                </h2>
              </div>

              <div class="flex flex-wrap gap-4 items-center">
                <div class="relative w-full sm:w-64">
                  <SearchIcon
                    class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-muted"
                  />
                  <input
                    v-model="searchInput"
                    type="search"
                    :placeholder="
                      $t(
                        'voiceActor.searchPlaceholder',
                        'Search roles, titles or actors...',
                      )
                    "
                    class="w-full theme-input border theme-border-subtle theme-border rounded-xl pl-10 pr-4 py-2 text-sm theme-focus transition-all theme-text"
                  />
                </div>

                <!-- Display Mode Toggle -->
                <div
                  class="flex theme-surface-raised theme-input rounded-lg p-1 border theme-border-subtle theme-border"
                >
                  <button
                    @click="displayMode = 'grouped'"
                    :class="[
                      'px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer',
                      displayMode === 'grouped'
                        ? 'theme-surface-muted theme-text shadow-sm'
                        : 'theme-text-muted theme-hover-text',
                    ]"
                  >
                    {{ $t("voiceActor.grouped", "Grouped") }}
                  </button>
                  <button
                    @click="displayMode = 'list'"
                    :class="[
                      'px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer',
                      displayMode === 'list'
                        ? 'theme-surface-muted theme-text shadow-sm'
                        : 'theme-text-muted theme-hover-text',
                    ]"
                  >
                    {{ $t("voiceActor.list", "List") }}
                  </button>
                </div>

                <!-- Sort Dropdown -->
                <select
                  v-model="sortMode"
                  :aria-label="$t('common.sort')"
                  class="theme-input border theme-border-subtle theme-border theme-text text-sm rounded-lg theme-focus block p-2 cursor-pointer"
                >
                  <option value="newest">
                    {{ $t("voiceActor.newestFirst", "Newest First") }}
                  </option>
                  <option value="oldest">
                    {{ $t("voiceActor.oldestFirst", "Oldest First") }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Category Tabs Bar (Below search, applies to all works) -->
            <div
              v-if="categoryTabs.length > 1"
              class="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
            >
              <button
                v-for="tab in categoryTabs"
                :key="tab.id"
                type="button"
                @click="activeTab = tab.id"
                class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all shrink-0 cursor-pointer border"
                :class="[
                  activeTab === tab.id
                    ? 'theme-selected shadow-xs font-semibold'
                    : 'theme-input theme-text-secondary theme-text-muted theme-border-subtle theme-border theme-hover-text theme-hover-border-strong',
                ]"
              >
                <component :is="tab.icon" class="w-4 h-4 shrink-0" />
                <span>{{ tab.label }}</span>
                <span
                  class="text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors"
                  :class="[
                    activeTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-700 theme-primary-text'
                      : 'theme-surface-raised theme-surface-muted theme-text-muted',
                  ]"
                >
                  {{ tab.count }}
                </span>
              </button>
            </div>
          </div>

          <div
            v-if="worksTotal === 0"
            class="theme-text-muted text-center py-12 theme-input rounded-2xl border theme-border-subtle theme-border"
          >
            {{
              $t("voiceActor.noWorksFound", "No works found for this actor.")
            }}
          </div>

          <template v-if="displayMode === 'list'">
            <PaginatedResponsiveGrid
              :key="`${searchQuery}|${activeTab}|${sortMode}`"
              :items="worksItems"
              :total-items="worksTotal"
              :page="worksPage"
              :page-size="12"
              grid-class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
              :item-key="(item) => item.work.id"
              @update:page="setWorksPage"
            >
              <template #default="{ item }">
                <div
                  :key="item.work.id"
                  class="theme-input border theme-border-subtle theme-border rounded-2xl p-4 shadow-sm transition-colors theme-hover-border block group"
                >
                  <div
                    class="flex flex-col sm:grid sm:grid-cols-3 gap-4 h-full"
                  >
                    <!-- Column 1: Media -->
                    <NuxtLink
                      :to="
                        localePath(
                          getMediaLink(
                            item.work.dubbing_projects?.content_type,
                            item.media.id,
                          ),
                        )
                      "
                      class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start cursor-pointer"
                    >
                      <div
                        class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <NuxtImg
                          format="webp"
                          decoding="async"
                          v-if="item.media.poster_path"
                          :src="resolveImageUrl(item.media.poster_path)"
                          :alt="item.media.title || item.media.name"
                          class="w-full h-full object-cover transition-transform duration-300"
                        />
                        <div
                          v-else
                          class="w-full h-full flex items-center justify-center theme-text-muted"
                        >
                          <ClapperboardIcon
                            class="w-6 h-6 sm:w-8 sm:h-8 opacity-20"
                          />
                        </div>
                      </div>
                      <div class="flex flex-col min-w-0 flex-1">
                        <span
                          class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5"
                          >{{
                            item.sortDate ? item.sortDate.split("-")[0] : ""
                          }}</span
                        >
                        <span
                          class="font-bold text-sm theme-text leading-tight line-clamp-2"
                          :title="item.media.title || item.media.name"
                          >{{ item.media.title || item.media.name }}</span
                        >
                        <div
                          v-if="item.work.dubbing_projects?.studios"
                          class="mt-1 flex min-w-0 overflow-hidden"
                        >
                          <span
                            class="text-[9px] px-1.5 py-0.5 theme-surface-raised theme-surface-muted theme-text-secondary rounded-md font-medium border theme-border-subtle theme-border truncate min-w-0"
                            :title="item.work.dubbing_projects.studios.name"
                          >
                            {{ item.work.dubbing_projects.studios.name }}
                          </span>
                        </div>
                      </div>
                    </NuxtLink>

                    <!-- Column 2: Original Actor -->
                    <NuxtLink
                      v-if="item.data.actor && item.data.actor.id > 0"
                      :to="localePath(`/actor/${item.data.actor.id}`)"
                      class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-3 sm:pt-0 cursor-pointer"
                    >
                      <div
                        class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <NuxtImg
                          format="webp"
                          decoding="async"
                          v-if="item.data.actor.profile_picture"
                          :src="
                            resolveImageUrl(item.data.actor.profile_picture)
                          "
                          :alt="item.data.actor.name"
                          class="w-full h-full object-cover"
                        />
                        <div
                          v-else
                          class="w-full h-full flex items-center justify-center theme-text-muted"
                        >
                          <UserIcon class="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                        </div>
                      </div>
                      <div class="flex flex-col min-w-0 flex-1">
                        <span
                          class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5"
                          >{{ $t("details.voicedBy") }}</span
                        >
                        <span
                          class="font-medium text-sm theme-text-secondary leading-tight line-clamp-2"
                          >{{ item.data.actor.name }}</span
                        >
                      </div>
                    </NuxtLink>
                    <div
                      v-else
                      class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-3 sm:pt-0"
                    >
                      <div
                        class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <div
                          class="w-full h-full flex items-center justify-center theme-text-muted"
                        >
                          <UserIcon class="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                        </div>
                      </div>
                      <div class="flex flex-col min-w-0 flex-1">
                        <span
                          class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5"
                          >{{ $t("details.voicedBy") }}</span
                        >
                        <span
                          class="font-medium text-sm theme-text-secondary leading-tight line-clamp-2"
                          >{{ $t("details.unknownCharacter") }}</span
                        >
                      </div>
                    </div>

                    <!-- Column 3: Character -->
                    <div
                      class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-3 sm:pt-0"
                    >
                      <div
                        class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 relative flex-shrink-0"
                      >
                        <NuxtImg
                          format="webp"
                          decoding="async"
                          v-if="item.data.characterImage"
                          :src="resolveImageUrl(item.data.characterImage)"
                          :alt="item.data.character"
                          class="w-full h-full object-cover"
                        />
                        <div
                          v-else
                          class="w-full h-full flex items-center justify-center theme-text-muted"
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
                          class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5"
                          >{{ $t("details.as") }}</span
                        >
                        <span
                          class="font-medium text-sm theme-text-secondary leading-tight line-clamp-2"
                          >{{ item.data.character || "Unknown" }}</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </PaginatedResponsiveGrid>
          </template>
          <template v-else>
            <div class="space-y-10">
              <div
                v-for="group in groupedWorks"
                :key="group.key"
                data-testid="voice-actor-group"
                class="space-y-4"
              >
                <!-- Actor Group Header -->
                <NuxtLink
                  v-if="group.actorId !== null && group.actorId > 0"
                  :to="localePath(`/actor/${group.actorId}`)"
                  class="sticky top-[68px] z-20 flex items-center gap-4 border-b theme-border-subtle theme-border pb-4 theme-surface-overlay backdrop-blur theme-hover-surface-muted p-2 -ml-2 rounded-xl transition-colors cursor-pointer group"
                >
                  <div
                    class="w-20 h-20 shrink-0 rounded-full overflow-hidden theme-surface-raised theme-input shadow-md border theme-border-subtle theme-border"
                  >
                    <NuxtImg
                      format="webp"
                      decoding="async"
                      v-if="group.actor.profile_picture"
                      :src="resolveImageUrl(group.actor.profile_picture)"
                      :alt="group.actor.name || $t('voiceActor.unknownActor')"
                      class="object-cover w-full h-full"
                    />
                    <UserIcon
                      v-else
                      class="w-full h-full theme-text-muted p-2"
                    />
                  </div>
                  <div>
                    <h3
                      class="text-xl font-bold theme-text group-hover:underline"
                    >
                      {{ group.actor.name || $t("voiceActor.unknownActor") }}
                    </h3>
                    <p class="text-sm theme-text-muted">
                      {{ group.worksCount }}{{ $t("common.works") }}
                    </p>
                  </div>
                </NuxtLink>
                <div
                  v-else
                  class="sticky top-[68px] z-20 flex items-center gap-4 border-b theme-border-subtle theme-border pb-4 theme-surface-overlay backdrop-blur p-2 -ml-2 rounded-xl"
                >
                  <div
                    class="w-20 h-20 shrink-0 rounded-full overflow-hidden theme-surface-raised theme-input shadow-md border theme-border-subtle theme-border"
                  >
                    <NuxtImg
                      format="webp"
                      decoding="async"
                      v-if="group.actor.profile_picture"
                      :src="resolveImageUrl(group.actor.profile_picture)"
                      :alt="group.actor.name || $t('voiceActor.unknownActor')"
                      class="object-cover w-full h-full"
                    />
                    <UserIcon
                      v-else
                      class="w-full h-full theme-text-muted p-2"
                    />
                  </div>
                  <div>
                    <h3 class="text-xl font-bold theme-text">
                      {{ group.actor.name || $t("voiceActor.unknownActor") }}
                    </h3>
                    <p class="text-sm theme-text-muted">
                      {{ group.worksCount }}{{ $t("common.works") }}
                    </p>
                  </div>
                </div>

                <!-- Actor Works Grid -->
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
                >
                  <div
                    v-for="item in group.works"
                    :key="item.work.id"
                    class="theme-input border theme-border-subtle theme-border rounded-2xl p-4 shadow-sm transition-colors theme-hover-border block group"
                  >
                    <div
                      class="flex flex-col sm:grid sm:grid-cols-2 gap-4 h-full"
                    >
                      <!-- Column 1: Media -->
                      <NuxtLink
                        :to="
                          localePath(
                            getMediaLink(
                              item.work.dubbing_projects?.content_type,
                              item.media.id,
                            ),
                          )
                        "
                        class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start cursor-pointer"
                      >
                        <div
                          class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 flex-shrink-0"
                        >
                          <NuxtImg
                            format="webp"
                            decoding="async"
                            v-if="item.media.poster_path"
                            :src="resolveImageUrl(item.media.poster_path)"
                            :alt="item.media.title || item.media.name"
                            class="w-full h-full object-cover transition-transform duration-300"
                          />
                          <div
                            v-else
                            class="w-full h-full flex items-center justify-center theme-text-muted"
                          >
                            <ClapperboardIcon class="w-6 h-6 opacity-20" />
                          </div>
                        </div>
                        <div class="flex flex-col min-w-0 flex-1">
                          <span
                            class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5"
                            >{{
                              item.sortDate ? item.sortDate.split("-")[0] : ""
                            }}</span
                          >
                          <span
                            class="font-bold text-sm theme-text leading-tight line-clamp-2"
                            :title="item.media.title || item.media.name"
                            >{{ item.media.title || item.media.name }}</span
                          >
                          <div
                            v-if="item.work.dubbing_projects?.studios"
                            class="mt-1 flex min-w-0 overflow-hidden"
                          >
                            <span
                              class="text-[9px] px-1.5 py-0.5 theme-surface-raised theme-surface-muted theme-text-secondary rounded-md font-medium border theme-border-subtle theme-border truncate min-w-0"
                              :title="item.work.dubbing_projects.studios.name"
                            >
                              {{ item.work.dubbing_projects.studios.name }}
                            </span>
                          </div>
                        </div>
                      </NuxtLink>

                      <!-- Column 2: Original Actor / Character -->
                      <div
                        class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-3 sm:pt-0"
                      >
                        <div
                          class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 relative flex-shrink-0"
                        >
                          <NuxtImg
                            format="webp"
                            decoding="async"
                            v-if="item.data.characterImage"
                            :src="resolveImageUrl(item.data.characterImage)"
                            :alt="item.data.character"
                            class="w-full h-full object-cover"
                          />
                          <div
                            v-else
                            class="w-full h-full flex items-center justify-center theme-text-muted"
                          >
                            <UserIcon class="w-6 h-6 opacity-20" />
                          </div>
                          <div
                            v-if="item.work.performance"
                            class="absolute bottom-1 left-1 right-1 flex justify-center"
                          >
                            <span
                              class="bg-black/70 backdrop-blur text-white text-[9px] px-2 py-0.5 rounded-full truncate max-w-full font-medium inline-block min-w-0"
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
                            class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5"
                            >{{ $t("details.as") }}</span
                          >
                          <span
                            class="font-medium text-sm theme-text-secondary leading-tight line-clamp-2"
                            >{{
                              item.data.character ||
                              $t("details.unknownCharacter")
                            }}</span
                          >
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <PaginationControls
              :page="worksPage"
              :total-items="worksTotal"
              :page-size="12"
              @update:page="setWorksPage"
            />
          </template>
        </section>
      </template>
    </PersonDetailsLayout>

    <div v-else class="text-center py-20 theme-text-muted min-h-screen">
      {{ $t("voiceActor.notFound") }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import PersonDetailsLayout from "../../components/layout/PersonDetailsLayout.vue";
import {
  useVoiceActorData,
  fetchVoiceActorData,
  fetchDetailCollection,
  APP_LOCALES,
} from "@app/shared-logic";
import type { PaginatedResponse } from "@app/shared-logic";
import { useRouter, useRoute } from "vue-router";
import {
  Clapperboard as ClapperboardIcon,
  User as UserIcon,
  Search as SearchIcon,
  Layers as LayersIcon,
  Film as FilmIcon,
  Tv as TvIcon,
  Gamepad2 as Gamepad2Icon,
  BookOpen as BookOpenIcon,
  Radio as RadioIcon,
  Megaphone as MegaphoneIcon,
  Smile as SmileIcon,
} from "lucide-vue-next";
import ReportModal from "../../components/ReportModal.vue";
import { computed, ref, watch } from "vue";
import { refDebounced } from "@vueuse/core";

const isReportModalOpen = ref(false);

const supabase = useSupabaseClient();
const router = useRouter();

const route = useRoute();
const voiceActorId = Number(route.params.id);
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);
const { locale, t, te } = useI18n();
const $t = t;
const $te = te;
const localePath = useLocalePath();

function normalizeContentType(contentType?: string | null): string {
  if (!contentType) return "movie";
  const c = contentType.toLowerCase().trim();
  if (
    c === "tv" ||
    c === "serie" ||
    c === "series" ||
    c === "show" ||
    c === "season" ||
    c === "episode"
  ) {
    return "tv";
  }
  if (c === "video_game" || c === "game") return "video_game";
  if (c === "audiobook" || c === "book") return "audiobook";
  if (c === "podcast") return "podcast";
  if (c === "advertisement" || c === "ad" || c === "commercial") {
    return "advertisement";
  }
  if (c === "toy") return "toy";
  if (c === "movie") return "movie";
  return c;
}

function getMediaLink(contentType?: string | null, mediaId?: number | string) {
  const c = normalizeContentType(contentType);
  if (c === "tv") return `/show/${mediaId}`;
  if (c === "video_game") return `/game/${mediaId}`;
  if (c === "audiobook") return `/audiobook/${mediaId}`;
  if (c === "podcast") return `/podcast/${mediaId}`;
  if (c === "advertisement") return `/advertisement/${mediaId}`;
  if (c === "toy") return `/toy/${mediaId}`;
  return `/movie/${mediaId}`;
}

const { data, pending } = await useAsyncData(
  `voice-actor-${voiceActorId}-${locale.value}`,
  () => {
    const tmdbLanguage =
      APP_LOCALES.find((l) => l.code === locale.value)?.language || "en-US";
    return fetchVoiceActorData(voiceActorId, tmdbLanguage);
  },
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const voiceActorData = useVoiceActorData(data);
const {
  voiceActor,
  profilePicture,
  backdropPath,
  loading,
  searchQuery,
  filteredEnhancedWork,
} = voiceActorData;

const searchInput = ref("");
const debouncedSearch = refDebounced(searchInput, 150);
watch(debouncedSearch, (val) => {
  searchQuery.value = val;
});

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
      if (newData.enhancedWorks) {
        voiceActorData.enhancedWorks.value = newData.enhancedWorks;
      }
      voiceActorData.medias.value = newData.medias;
      voiceActorData.characterProfilePictures.value =
        newData.characterProfilePictures;
      voiceActorData.profilePicture.value = newData.profilePicture;
      voiceActorData.backdropPath.value = newData.backdropPath;
      voiceActorData.potentialWikipediaUrl.value =
        newData.potentialWikipediaUrl;
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
  return `https://dubbingbase.com/api/og-image?type=voice-actor&id=${voiceActorId}`;
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
      : t("seo.voiceActorTitleFallback", "Voice Actor"),
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
          : t("seo.voiceActorTitleFallback", "Voice Actor"),
      ),
    },
    { property: "og:description", content: actorDescription },
    { property: "og:type", content: "profile" },
    {
      property: "og:locale",
      content: computed(() => {
        const map: Record<string, string> = {
          fr: "fr_FR",
          en: "en_US",
          es: "es_ES",
          ja: "ja_JP",
        };
        return map[locale.value] || "en_US";
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
          : t("seo.voiceActorTitleFallback", "Voice Actor"),
      ),
    },
    { name: "twitter:description", content: actorDescription },
    { name: "twitter:image", content: ogImageUrl },
  ],
  link: [
    { rel: "canonical", href: canonicalUrl },
    { rel: "preconnect", href: "https://image.tmdb.org", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://image.tmdb.org" },
  ],
  script: [
    {
      type: "application/ld+json",
      innerHTML: computed(() => {
        const json = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: canonicalUrl.value,
          name: actorName.value
            ? `${actorName.value} - Voice Actor`
            : "Voice Actor",
          mainEntity: {
            "@type": "Person",
            name:
              actorName.value ||
              t("seo.voiceActorTitleFallback", "Voice Actor"),
            jobTitle: t("seo.voiceActorTitleFallback", "Voice Actor"),
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
const activeTab = ref<string>("all");
const { page: worksPage, setPage: setWorksPage } =
  useUrlPagination("worksPage");

type VoiceActorWorkItem = {
  work: {
    id: number;
    actor_id: number;
    performance?: string | null;
    dubbing_projects?: {
      content_type?: string | null;
      studios?: {
        id: number;
        name: string;
        logo_url: string | null;
      } | null;
    } | null;
  };
  media: {
    id: number;
    title: string;
    name: string;
    poster_path: string | null;
  };
  data: {
    character?: string;
    characterImage?: string;
    actor?: {
      id: number;
      name?: string;
      profile_picture?: string;
    } | null;
  };
  sortDate?: string;
};
type VoiceActorWorkGroup = {
  key: string;
  actorId: number | null;
  actor: {
    id: number | null;
    name: string | null;
    profile_picture: string | null;
  };
  works: VoiceActorWorkItem[];
  worksCount: number;
};
type VoiceActorCollectionItem = VoiceActorWorkItem | VoiceActorWorkGroup;

function isVoiceActorWorkGroup(
  item: VoiceActorCollectionItem,
): item is VoiceActorWorkGroup {
  return "works" in item;
}

const worksRequest = computed(() => ({
  collection: "voice-actor-works" as const,
  id: voiceActorId,
  query: searchQuery.value,
  category: activeTab.value,
  sort: sortMode.value,
  view: displayMode.value,
  lang:
    APP_LOCALES.find((item) => item.code === locale.value)?.language || "en-US",
  page: worksPage.value,
  pageSize: 12,
}));
const { data: worksPageData } = useAsyncData<
  PaginatedResponse<VoiceActorCollectionItem>
>(
  `voice-actor-works-${voiceActorId}-${locale.value}`,
  () => fetchDetailCollection<VoiceActorCollectionItem>(worksRequest.value),
  {
    watch: [worksRequest],
    getCachedData: (key, nuxtApp, { cause }) =>
      cause === "initial"
        ? (nuxtApp.payload.data[key] ?? nuxtApp.static.data[key])
        : undefined,
  },
);
const collectionItems = computed(() => worksPageData.value?.data || []);
const worksItems = computed(() =>
  collectionItems.value.filter(
    (item): item is VoiceActorWorkItem => !isVoiceActorWorkGroup(item),
  ),
);
const groupedWorks = computed(() =>
  collectionItems.value.filter(isVoiceActorWorkGroup),
);
const worksTotal = computed(
  () => worksPageData.value?.pagination.totalItems || 0,
);

const CATEGORY_TABS_CONFIG = [
  { id: "all", labelKey: "search.all", defaultLabel: "All", icon: LayersIcon },
  {
    id: "movie",
    labelKey: "search.movie",
    defaultLabel: "Movies",
    icon: FilmIcon,
  },
  { id: "tv", labelKey: "search.tv", defaultLabel: "Series", icon: TvIcon },
  {
    id: "video_game",
    labelKey: "search.videoGame",
    defaultLabel: "Video Games",
    icon: Gamepad2Icon,
  },
  {
    id: "audiobook",
    labelKey: "search.audiobook",
    defaultLabel: "Audiobooks",
    icon: BookOpenIcon,
  },
  {
    id: "podcast",
    labelKey: "search.podcast",
    defaultLabel: "Podcasts",
    icon: RadioIcon,
  },
  {
    id: "advertisement",
    labelKey: "search.advertisement",
    defaultLabel: "Commercials",
    icon: MegaphoneIcon,
  },
  { id: "toy", labelKey: "search.toy", defaultLabel: "Toys", icon: SmileIcon },
] as const;

const categoryTabs = computed(() => {
  const allWorks = voiceActorData.enhancedWork.value || [];
  const searchFiltered = filteredEnhancedWork.value || [];

  const totalCounts: Record<string, number> = {
    all: allWorks.length,
    movie: 0,
    tv: 0,
    video_game: 0,
    audiobook: 0,
    podcast: 0,
    advertisement: 0,
    toy: 0,
  };

  for (const item of allWorks) {
    const cType = normalizeContentType(
      item.work.dubbing_projects?.content_type,
    );
    totalCounts[cType] = (totalCounts[cType] || 0) + 1;
  }

  const filteredCounts: Record<string, number> = {
    all: searchFiltered.length,
    movie: 0,
    tv: 0,
    video_game: 0,
    audiobook: 0,
    podcast: 0,
    advertisement: 0,
    toy: 0,
  };

  for (const item of searchFiltered) {
    const cType = normalizeContentType(
      item.work.dubbing_projects?.content_type,
    );
    filteredCounts[cType] = (filteredCounts[cType] || 0) + 1;
  }

  return CATEGORY_TABS_CONFIG.filter((cfg) => {
    if (cfg.id === "all") return true;
    return (totalCounts[cfg.id] || 0) > 0;
  }).map((cfg) => {
    return {
      id: cfg.id,
      label: $te(cfg.labelKey) ? $t(cfg.labelKey) : cfg.defaultLabel,
      icon: cfg.icon,
      count: filteredCounts[cfg.id] || 0,
      totalCount: totalCounts[cfg.id] || 0,
    };
  });
});

watch(categoryTabs, (tabs) => {
  if (
    activeTab.value !== "all" &&
    !tabs.some((t) => t.id === activeTab.value)
  ) {
    activeTab.value = "all";
  }
});

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

watch([searchQuery, activeTab, sortMode, displayMode], () => {
  void setWorksPage(1);
});
</script>
