# dubbing-base-monorepo — AI Context Map

> **Stack:** nuxt | none | vue | typescript
> **Monorepo:** @app/mobile, @app/website, @app/supabase, @app/locales, @app/og-image, @app/shared-logic

> 75 routes | 16 models | 197 components | 78 lib files | 63 env vars | 12 middleware | 5% test coverage
> **Token savings:** this file is ~14,600 tokens. Without it, AI exploration would cost ~150,000 tokens. **Saves ~135,300 tokens per conversation.**
> **Last scanned:** 2026-09-17 14:53 — re-run after significant changes

---

# Routes

- `GET` `/api/actor/:id` params(id) [cache]
- `GET` `/api/advertisement/:id` params(id) [cache, queue]
- `GET` `/api/audiobook/:id` params(id) [cache, queue]
- `GET` `/api/career-grid` [cache]
- `POST` `/api/cast-vote`
- `POST` `/api/count-voice-actor-works`
- `POST` `/api/create-user-profile` [auth, db]
- `GET` `/api/dashboard-stats` [auth, cache]
- `POST` `/api/delete-user-voice-actor-link` [db]
- `POST` `/api/delete-voice-actor-link` [auth, db]
- `POST` `/api/delete-work-entry` [auth, db]
- `POST` `/api/delete_user` [auth]
- `GET` `/api/detail-collections` [cache] ✓
- `GET` `/api/episode/index` [cache]
- `POST` `/api/extract-credits-from-image` [upload]
- `POST` `/api/extract-voice-actor-info` [auth]
- `GET` `/api/find_duplicate_voice_actors` [auth, cache]
- `GET` `/api/find_duplicate_work` [auth, cache]
- `GET` `/api/game/:id` params(id) [cache, queue]
- `POST` `/api/generate-social-content` [auth, email]
- `GET` `/api/get-dubbing-project` [cache]
- `GET` `/api/get-media-credits` [cache]
- `GET` `/api/get-metadata` [cache]
- `GET` `/api/get-random-task` [auth, cache]
- `GET` `/api/get-studio-details` [cache]
- `GET` `/api/get-user-profile` [auth, cache]
- `ALL` `/api/get-user-voice-actor` [auth, cache]
- `GET` `/api/get-user-voice-actors` [auth, cache]
- `GET` `/api/get-work-votes` [cache]
- `GET` `/api/home-stats` [cache]
- `POST` `/api/internal-media-create` [auth, db]
- `GET` `/api/internal-media-credits` [cache]
- `GET` `/api/internal-media-metadata` [cache]
- `POST` `/api/link-user-voice-actor` [db]
- `POST` `/api/link-voice-actor` [auth, db]
- `GET` `/api/list-voice-actors` [cache]
- `GET` `/api/list_users` [auth, cache]
- `POST` `/api/manage-subscription` [db]
- `POST` `/api/media-queue` [auth, cache, queue]
- `POST` `/api/merge_voice_actor_duplicates` [auth]
- `GET` `/api/movie/:id` params(id) [cache, queue]
- `POST` `/api/notify-subscribers` [auth, webhook]
- `GET` `/api/og-image/index` [cache]
- `GET` `/api/podcast/:id` params(id) [cache, queue]
- `POST` `/api/prepare-trending-media` [auth, queue]
- `POST` `/api/prepare_game` [auth]
- `POST` `/api/prepare_media` [auth]
- `POST` `/api/process-credits` [db]
- `POST` `/api/process-media-queue` [auth, cache, queue]
- `GET` `/api/recent-voice-actors` [cache]
- `POST` `/api/request-voice-actor-page` [auth, email]
- `POST` `/api/revert-task` [db]
- `POST` `/api/save-dubbing-project` [auth, db]
- `POST` `/api/save-metadata` [db]
- `POST` `/api/save-studio` [db]
- `GET` `/api/search/index` [db, cache]
- `GET` `/api/search-voice-actors` [cache]
- `GET` `/api/season/index` [cache]
- `GET` `/api/show/:id` params(id) [cache, queue]
- `POST` `/api/submit-task` [db, upload]
- `POST` `/api/submit-user-report` [db]
- `GET` `/api/top-contributors` [cache]
- `GET` `/api/top-voice-actors` [cache]
- `GET` `/api/toy/:id` params(id) [cache, queue]
- `GET` `/api/trending/games` [cache]
- `GET` `/api/trending/movies` [cache]
- `GET` `/api/trending/shows` [cache]
- `GET` `/api/trending/voice-actors` [cache]
- `POST` `/api/update-review-status` [db, cache]
- `POST` `/api/update-user-profile`
- `POST` `/api/update-voice-actor` [auth, db, upload]
- `POST` `/api/update_user_role` [auth]
- `POST` `/api/update_voice_actor_link` [auth, db]
- `POST` `/api/upload-profile-picture` [auth, db, upload]
- `GET` `/api/voice-actor/:id` params(id) [cache]

---

# Schema

### voice_actors
- id: bigint (required)
- tmdb_id: bigint (fk)

### source
- id: bigint (required)
- user_id: bigint (fk)
- suggested_at: timestamp without time zone (default)

### work
- id: bigint (required)
- content_id: bigint (required, fk)
- actor_id: bigint (required, fk)
- voice_actor_id: bigint (fk)
- highlight: boolean (default)
- source_id: bigint (fk)

### user_profiles
- id: uuid (pk)
- user_id: uuid (required, fk)
- bio: text
- nationality: text
- date_of_birth: date
- social_media_links: jsonb

### user_profile_links
- id: uuid (pk)
- user_id: uuid (required, fk)
- profile_id: uuid (required, fk)

### user_voice_actor_links
- id: uuid (pk)
- user_id: uuid (required, fk)
- voice_actor_id: integer (required, fk)

### votes
- id: bigint (pk)
- user_id: uuid (required, fk)
- work_id: bigint (required, fk)
- vote_type: text (required)

### dubbing_projects
- id: bigint (pk)
- content_id: bigint (required, fk)
- content_type: text (required)
- language: text (default)
- studio: text
- artistic_director: text
- adaptation: text
- recording: text
- editing: text
- mixing: text
- project_manager: text
- creative_supervision: text
- status: text

### studios
- id: bigint (pk)
- name: text (required)
- description: text
- country: text
- city: text
- website_url: text
- logo_url: text

### dubbing_project_crew
- id: bigint (pk)
- dubbing_project_id: bigint (required, fk)
- person_id: bigint (required, fk)
- job: text (required)

### jobs
- id: bigint (pk)
- name: text (required)

### project_attachments
- id: bigint (pk)
- dubbing_project_id: bigint (required, fk)
- file_path: text (required)
- file_name: text (required)
- description: text
- created_by: uuid (default)

### voice_actor_subscriptions
- user_id: uuid (required, fk)
- voice_actor_id: bigint (required, fk)

### user_reports
- id: uuid (pk)
- reporter_id: uuid (required, fk)
- target_url: text (required)
- reason: text (required)
- details: text

### audit_logs
- id: uuid (pk)
- user_id: uuid (fk)
- entity_type: text (required)
- entity_id: text (required, fk)
- previous_value: jsonb
- new_value: jsonb
- points_awarded: integer (default)
- reverted_at: timestamp(tz)

### gamification_task_locks
- category: text (required)
- entity_id: text (required, fk)
- locked_at: timestamp(tz) (default)

---

# Components

- **App** [client] — `apps/mobile/src/App.vue`
- **ActionButtons** [client] — props: hasWikidataId, hasData, isFetching, isScanning, fetchError, queueStatus, queueErrorMessage — `apps/mobile/src/components/ActionButtons.vue`
- **ActorItem** [client] — props: actor, voiceActors, isAdmin, goToActor, goToVoiceActor, editVoiceActorLink, confirmDeleteVoiceActorLink, openVoiceActorSearch — `apps/mobile/src/components/ActorItem.vue`
- **ActorList** [client] — props: actors, voiceActors — `apps/mobile/src/components/ActorList.vue`
- **ActorVoiceActorItem** [client] — props: type, actor, item — `apps/mobile/src/components/ActorVoiceActorItem.vue`
- **ActorWithVoiceActors** [client] — `apps/mobile/src/components/ActorWithVoiceActors.vue`
- **CollectionCard** [client] — props: collection — `apps/mobile/src/components/CollectionCard.vue`
- **CreditsReviewModal** [client] — props: isOpen, extractedCredits — `apps/mobile/src/components/CreditsReviewModal.vue`
- **CrewList** [client] — props: groupedCrew — `apps/mobile/src/components/CrewList.vue`
- **DubbingProjectsView** [client] — props: contentId, contentType, projects, actors, isAdmin, getVoiceActorByTmdbId, goToActor, goToVoiceActor, editVoiceActorLink, confirmDeleteVoiceActorLink — `apps/mobile/src/components/DubbingProjectsView.vue`
- **EpisodeBanner** [client] — `apps/mobile/src/components/EpisodeBanner.vue`
- **EpisodesList** [client] — `apps/mobile/src/components/EpisodesList.vue`
- **JobSearchModal** [client] — props: isOpen, jobs — `apps/mobile/src/components/JobSearchModal.vue`
- **MediaInfoCard** [client] — `apps/mobile/src/components/MediaInfoCard.vue`
- **MediaItem** [client] — `apps/mobile/src/components/MediaItem.vue`
- **MediaThumbnail** [client] — props: path, type, required, default — `apps/mobile/src/components/MediaThumbnail.vue`
- **MovieCard** [client] — `apps/mobile/src/components/MovieCard.vue`
- **NoActors** [client] — `apps/mobile/src/components/NoActors.vue`
- **NoVoiceActor** [client] — props: actor — `apps/mobile/src/components/NoVoiceActor.vue`
- **PersonItem** [client] — props: person, type, subtitleOverride — `apps/mobile/src/components/PersonItem.vue`
- **PersonSearchModal** [client] — props: isOpen, mediaId, workType, linkVoiceActor — `apps/mobile/src/components/PersonSearchModal.vue`
- **RequestVoiceActorCard** [client] — props: voiceActor — `apps/mobile/src/components/RequestVoiceActorCard.vue`
- **SearchResultItem** [client] — `apps/mobile/src/components/SearchResultItem.vue`
- **SeasonBanner** [client] — `apps/mobile/src/components/SeasonBanner.vue`
- **Serie** [client] — props: value, type, required — `apps/mobile/src/components/Serie.vue`
- **StudioCard** [client] — props: studio — `apps/mobile/src/components/StudioCard.vue`
- **StudioSearchModal** [client] — props: isOpen — `apps/mobile/src/components/StudioSearchModal.vue`
- **TmdbPersonSearchModal** [client] — props: isOpen, persons — `apps/mobile/src/components/TmdbPersonSearchModal.vue`
- **VoiceActor** [client] — props: modelValue — `apps/mobile/src/components/VoiceActor.vue`
- **VoiceActorBio** [client] — `apps/mobile/src/components/VoiceActorBio.vue`
- **VoiceActorFetchModal** [client] — props: isOpen, voiceActor — `apps/mobile/src/components/VoiceActorFetchModal.vue`
- **VoiceActorHeader** [client] — `apps/mobile/src/components/VoiceActorHeader.vue`
- **VoiceActorList** [client] — props: voiceActors, actor, isAdmin, goToVoiceActor, editVoiceActorLink, confirmDeleteVoiceActorLink, openVoiceActorSearch — `apps/mobile/src/components/VoiceActorList.vue`
- **VoiceActorWorksGrouped** [client] — `apps/mobile/src/components/VoiceActorWorksGrouped.vue`
- **AppActionSheet** [client] — props: isOpen, header, buttons — `apps/mobile/src/components/common/AppActionSheet.vue`
- **AppAlertContainer** [client] — `apps/mobile/src/components/common/AppAlertContainer.vue`
- **AppAvatar** [client] — props: size — `apps/mobile/src/components/common/AppAvatar.vue`
- **AppBackButton** [client] — `apps/mobile/src/components/common/AppBackButton.vue`
- **AppBadge** [client] — props: color — `apps/mobile/src/components/common/AppBadge.vue`
- **AppButton** [client] — props: fill, expand, color, shape, disabled, type — `apps/mobile/src/components/common/AppButton.vue`
- **AppCard** [client] — props: button, clickable, href, replace — `apps/mobile/src/components/common/AppCard.vue`
- **AppCardContent** [client] — `apps/mobile/src/components/common/AppCardContent.vue`
- **AppChip** [client] — props: outline, color — `apps/mobile/src/components/common/AppChip.vue`
- **AppImage** [client] — props: src, alt — `apps/mobile/src/components/common/AppImage.vue`
- **AppInput** [client] — props: modelValue, label, labelPlacement, type, placeholder, disabled — `apps/mobile/src/components/common/AppInput.vue`
- **AppLabel** [client] — props: wrap — `apps/mobile/src/components/common/AppLabel.vue`
- **AppList** [client] — props: inset — `apps/mobile/src/components/common/AppList.vue`
- **AppListItem** [client] — props: button, clickable, href, disabled, lines, detail, replace — `apps/mobile/src/components/common/AppListItem.vue`
- **AppModal** [client] — props: isOpen, isFullScreen, maxHeight, canSwipe, overlay, breakpoints, initialBreakpoint — `apps/mobile/src/components/common/AppModal.vue`
- **AppSearchbar** [client] — props: modelValue, placeholder, disabled, animated, debounce — `apps/mobile/src/components/common/AppSearchbar.vue`
- **AppSkeleton** [client] — props: animated — `apps/mobile/src/components/common/AppSkeleton.vue`
- **AppSpinner** [client] — props: name, color — `apps/mobile/src/components/common/AppSpinner.vue`
- **AppText** [client] — props: color, tag — `apps/mobile/src/components/common/AppText.vue`
- **AppTextarea** [client] — props: modelValue, label, labelPlacement, placeholder, disabled, rows — `apps/mobile/src/components/common/AppTextarea.vue`
- **AppToggle** [client] — props: checked, disabled, color — `apps/mobile/src/components/common/AppToggle.vue`
- **ConfirmDialog** [client] — `apps/mobile/src/components/common/ConfirmDialog.vue`
- **EditableField** [client] — `apps/mobile/src/components/common/EditableField.vue`
- **EmptyState** [client] — props: text — `apps/mobile/src/components/common/EmptyState.vue`
- **ErrorMessage** [client] — `apps/mobile/src/components/common/ErrorMessage.vue`
- **ImageEditorModal** [client] — props: isOpen, imageFile, aspectRatio — `apps/mobile/src/components/common/ImageEditorModal.vue`
- **LoadingSpinner** [client] — `apps/mobile/src/components/common/LoadingSpinner.vue`
- **AppContent** [client] — props: fullscreen — `apps/mobile/src/components/common/layout/AppContent.vue`
- **AppHeader** [client] — `apps/mobile/src/components/common/layout/AppHeader.vue`
- **AppPage** [client] — `apps/mobile/src/components/common/layout/AppPage.vue`
- **AppSegment** [client] — props: modelValue, scrollable, bgColor — `apps/mobile/src/components/common/layout/AppSegment.vue`
- **AppSegmentButton** [client] — props: value, contentId — `apps/mobile/src/components/common/layout/AppSegmentButton.vue`
- **AppSegmentContent** [client] — props: id — `apps/mobile/src/components/common/layout/AppSegmentContent.vue`
- **AppSegmentView** [client] — props: activeSegment — `apps/mobile/src/components/common/layout/AppSegmentView.vue`
- **AppTitle** [client] — `apps/mobile/src/components/common/layout/AppTitle.vue`
- **AppToolbar** [client] — `apps/mobile/src/components/common/layout/AppToolbar.vue`
- **AddWorkModal** [client] — `apps/mobile/src/components/profile/AddWorkModal.vue`
- **ProfileBasicInfo** [client] — `apps/mobile/src/components/profile/ProfileBasicInfo.vue`
- **ProfilePictureEditor** [client] — `apps/mobile/src/components/profile/ProfilePictureEditor.vue`
- **ProfileVoiceActorSelector** [client] — `apps/mobile/src/components/profile/ProfileVoiceActorSelector.vue`
- **WorkItem** [client] — `apps/mobile/src/components/profile/WorkItem.vue`
- **WorkList** [client] — props: canEdit — `apps/mobile/src/components/profile/WorkList.vue`
- **about** [client] — `apps/mobile/src/views/about.vue`
- **actor-details** [client] — `apps/mobile/src/views/actor-details.vue`
- **advertisement-details** [client] — `apps/mobile/src/views/advertisement-details.vue`
- **audiobook-details** [client] — `apps/mobile/src/views/audiobook-details.vue`
- **edit-dubbing-project** [client] — `apps/mobile/src/views/edit-dubbing-project.vue`
- **edit-studio** [client] — `apps/mobile/src/views/edit-studio.vue`
- **game-details** [client] — `apps/mobile/src/views/game-details.vue`
- **home** [client] — `apps/mobile/src/views/home.vue`
- **login** [client] — `apps/mobile/src/views/login.vue`
- **movie-details** [client] — `apps/mobile/src/views/movie-details.vue`
- **podcast-details** [client] — `apps/mobile/src/views/podcast-details.vue`
- **profile** [client] — `apps/mobile/src/views/profile.vue`
- **search** [client] — `apps/mobile/src/views/search.vue`
- **season-by-episodes** [client] — `apps/mobile/src/views/season-by-episodes.vue`
- **season-details** [client] — `apps/mobile/src/views/season-details.vue`
- **serie-details** [client] — `apps/mobile/src/views/serie-details.vue`
- **settings** [client] — `apps/mobile/src/views/settings.vue`
- **studio-details** [client] — `apps/mobile/src/views/studio-details.vue`
- **toy-details** [client] — `apps/mobile/src/views/toy-details.vue`
- **voice-actor-details** [client] — `apps/mobile/src/views/voice-actor-details.vue`
- **voice-actor-profile** [client] — `apps/mobile/src/views/voice-actor-profile.vue`
- **app** [client] — `apps/website/src/app.vue`
- **Footer** [client] — `apps/website/src/components/Footer.vue`
- **ForceEnqueueButton** [client] — props: mediaType, mediaId, seasonNumber, episodeNumber, language — `apps/website/src/components/ForceEnqueueButton.vue`
- **Header** [client] — `apps/website/src/components/Header.vue`
- **LanguageBanner** [client] — `apps/website/src/components/LanguageBanner.vue`
- **MediaSkeleton** [client] — `apps/website/src/components/MediaSkeleton.vue`
- **PaginatedResponsiveGrid** [client] — props: items, pageSize, totalItems, page, gridClass, itemKey — `apps/website/src/components/PaginatedResponsiveGrid.vue`
- **PaginationControls** [client] — props: page, totalItems, pageSize — `apps/website/src/components/PaginationControls.vue`
- **PersonSkeleton** [client] — `apps/website/src/components/PersonSkeleton.vue`
- **PwaLifecycleBanner** [client] — `apps/website/src/components/PwaLifecycleBanner.vue`
- **ReportModal** [client] — props: open, targetUrl — `apps/website/src/components/ReportModal.vue`
- **SearchFilters** [client] — props: modelValue — `apps/website/src/components/SearchFilters.vue`
- **SearchResultItem** [client] — props: result, mediaTypeLabel, selected — `apps/website/src/components/SearchResultItem.vue`
- **UnderConstruction** [client] — `apps/website/src/components/UnderConstruction.vue`
- **AsyncAutocomplete** [client] — props: modelValue, options, loading, placeholder, disabled, allowCreate, displayFn — `apps/website/src/components/admin/AsyncAutocomplete.vue`
- **LanguageSelect** [client] — props: modelValue, required — `apps/website/src/components/admin/LanguageSelect.vue`
- **BarChart** [client] — `apps/website/src/components/admin/charts/BarChart.vue`
- **LineChart** [client] — `apps/website/src/components/admin/charts/LineChart.vue`
- **PieChart** [client] — `apps/website/src/components/admin/charts/PieChart.vue`
- **AdvertisementProjectEditor** [client] — `apps/website/src/components/admin/editors/AdvertisementProjectEditor.vue`
- **AudiobookProjectEditor** [client] — `apps/website/src/components/admin/editors/AudiobookProjectEditor.vue`
- **GameProjectEditor** [client] — `apps/website/src/components/admin/editors/GameProjectEditor.vue`
- **MovieProjectEditor** [client] — `apps/website/src/components/admin/editors/MovieProjectEditor.vue`
- **PodcastProjectEditor** [client] — `apps/website/src/components/admin/editors/PodcastProjectEditor.vue`
- **ShowProjectEditor** [client] — `apps/website/src/components/admin/editors/ShowProjectEditor.vue`
- **ToyProjectEditor** [client] — `apps/website/src/components/admin/editors/ToyProjectEditor.vue`
- **MediaDetailsLayout** [client] — props: title, backdropUrl, posterUrl, loading — `apps/website/src/components/layout/MediaDetailsLayout.vue`
- **PersonDetailsLayout** [client] — props: name, profileUrl, backdropUrl, loading — `apps/website/src/components/layout/PersonDetailsLayout.vue`
- **DetailsActionBar** [client] — `apps/website/src/components/layout/details/DetailsActionBar.vue`
- **DetailsHero** [client] — props: title, backdropUrl, blurBackdrop, imageUrl, imageAspectRatio — `apps/website/src/components/layout/details/DetailsHero.vue`
- **DetailsPage** [client] — `apps/website/src/components/layout/details/DetailsPage.vue`
- **admin** [client] — `apps/website/src/layouts/admin.vue`
- **about** [client] — `apps/website/src/pages/about.vue`
- **[id]** [client] — `apps/website/src/pages/actor/[id].vue`
- **[id]** [client] — `apps/website/src/pages/admin/add-voice-cast/[id].vue`
- **audit-logs** [client] — `apps/website/src/pages/admin/audit-logs.vue`
- **career-grid** [client] — `apps/website/src/pages/admin/career-grid.vue`
- **duplicates-va** [client] — `apps/website/src/pages/admin/duplicates-va.vue`
- **duplicates-work** [client] — `apps/website/src/pages/admin/duplicates-work.vue`
- **index** [client] — `apps/website/src/pages/admin/index.vue`
- **manual-merge-va** [client] — `apps/website/src/pages/admin/manual-merge-va.vue`
- **queue** [client] — `apps/website/src/pages/admin/queue.vue`
- **reports** [client] — `apps/website/src/pages/admin/reports.vue`
- **[id]** [client] — `apps/website/src/pages/admin/studios/edit/[id].vue`
- **new** [client] — `apps/website/src/pages/admin/studios/new.vue`
- **user-va-profiles** [client] — `apps/website/src/pages/admin/user-va-profiles.vue`
- **users** [client] — `apps/website/src/pages/admin/users.vue`
- **voice-actor-spreadsheet** [client] — `apps/website/src/pages/admin/voice-actor-spreadsheet.vue`
- **edit** [client] — `apps/website/src/pages/advertisement/[adId]/projects/[projectId]/edit.vue`
- **new** [client] — `apps/website/src/pages/advertisement/[adId]/projects/new.vue`
- **[id]** [client] — `apps/website/src/pages/advertisement/[id].vue`
- **new** [client] — `apps/website/src/pages/advertisement/new.vue`
- **edit** [client] — `apps/website/src/pages/audiobook/[audiobookId]/projects/[projectId]/edit.vue`
- **new** [client] — `apps/website/src/pages/audiobook/[audiobookId]/projects/new.vue`
- **[id]** [client] — `apps/website/src/pages/audiobook/[id].vue`
- **index** [client] — `apps/website/src/pages/contribute/index.vue`
- **play** [client] — `apps/website/src/pages/contribute/task/play.vue`
- **discussions** [client] — `apps/website/src/pages/discussions.vue`
- **edit** [client] — `apps/website/src/pages/game/[gameId]/projects/[projectId]/edit.vue`
- **new** [client] — `apps/website/src/pages/game/[gameId]/projects/new.vue`
- **[id]** [client] — `apps/website/src/pages/game/[id].vue`
- **guidelines** [client] — `apps/website/src/pages/guidelines.vue`
- **index** [client] — `apps/website/src/pages/index.vue`
- **leaderboard** [client] — `apps/website/src/pages/leaderboard.vue`
- **legal** [client] — `apps/website/src/pages/legal.vue`
- **login** [client] — `apps/website/src/pages/login.vue`
- **[id]** [client] — `apps/website/src/pages/movie/[id].vue`
- **edit** [client] — `apps/website/src/pages/movie/[movieId]/projects/[projectId]/edit.vue`
- **new** [client] — `apps/website/src/pages/movie/[movieId]/projects/new.vue`
- **movies** [client] — `apps/website/src/pages/movies.vue`
- **[id]** [client] — `apps/website/src/pages/podcast/[id].vue`
- **edit** [client] — `apps/website/src/pages/podcast/[podcastId]/projects/[projectId]/edit.vue`
- **new** [client] — `apps/website/src/pages/podcast/[podcastId]/projects/new.vue`
- **new** [client] — `apps/website/src/pages/podcast/new.vue`
- **privacy** [client] — `apps/website/src/pages/privacy.vue`
- **api-key** [client] — `apps/website/src/pages/profile/api-key.vue`
- **index** [client] — `apps/website/src/pages/profile/index.vue`
- **settings** [client] — `apps/website/src/pages/profile/settings.vue`
- **profile** [client] — `apps/website/src/pages/profile.vue`
- **register** [client] — `apps/website/src/pages/register.vue`
- **search** [client] — `apps/website/src/pages/search.vue`
- **series** [client] — `apps/website/src/pages/series.vue`
- **[episodeNumber]** [client] — `apps/website/src/pages/show/[id]/season/[seasonNumber]/episode/[episodeNumber].vue`
- **[seasonNumber]** [client] — `apps/website/src/pages/show/[id]/season/[seasonNumber].vue`
- **[id]** [client] — `apps/website/src/pages/show/[id].vue`
- **edit** [client] — `apps/website/src/pages/show/[showId]/projects/[projectId]/edit.vue`
- **new** [client] — `apps/website/src/pages/show/[showId]/projects/new.vue`
- **[id]** [client] — `apps/website/src/pages/studio/[id].vue`
- **edit** [client] — `apps/website/src/pages/studio/[studioId]/edit.vue`
- **studios** [client] — `apps/website/src/pages/studios.vue`
- **terms-api** [client] — `apps/website/src/pages/terms-api.vue`
- **terms** [client] — `apps/website/src/pages/terms.vue`
- **[id]** [client] — `apps/website/src/pages/toy/[id].vue`
- **edit** [client] — `apps/website/src/pages/toy/[toyId]/projects/[projectId]/edit.vue`
- **new** [client] — `apps/website/src/pages/toy/[toyId]/projects/new.vue`
- **new** [client] — `apps/website/src/pages/toy/new.vue`
- **[id]** [client] — `apps/website/src/pages/voice-actor/[id].vue`
- **edit** [client] — `apps/website/src/pages/voice-actor/[voiceActorId]/edit.vue`
- **new** [client] — `apps/website/src/pages/voice-actor/new.vue`
- **voice-actors** [client] — `apps/website/src/pages/voice-actors.vue`

---

# Libraries

- `apps/mobile/src/api/mediaQueue.ts` — function enqueueMedia: (params) => Promise<void>
- `apps/mobile/src/api/nitro.ts` — function nitroRequest: (path, options?) => Promise<
- `apps/mobile/src/composables/useDeferredCharacters.ts` — function useDeferredCharacters: (castSource) => void
- `apps/mobile/src/composables/useFF.ts` — function useFeatureFlags: () => void
- `apps/mobile/src/composables/useLanguagePreference.ts` — function useLanguagePreference: () => void
- `apps/mobile/src/composables/useOneSignal.ts` — function useOneSignal: () => void
- `apps/mobile/src/composables/usePermissions.ts` — function usePermissions: () => void
- `apps/mobile/src/composables/usePostHog.ts` — function usePostHog: () => void
- `apps/mobile/src/composables/useTheme.ts` — function useTheme: () => void
- `apps/mobile/src/composables/useToast.ts` — function useToast: () => void, const toastController
- `apps/mobile/src/composables/useVoiceActorManagement.ts`
  - function useVoiceActorManagement: (workType) => void
  - interface VoiceActor
  - interface WorkAndVoiceActor
- `apps/mobile/src/composables/useVoiceActorSubscription.ts` — function useVoiceActorSubscription: (voiceActorId) => void, function fetchAllSubscriptions: () => void
- `apps/mobile/src/stores/index.ts` — function setupStores, const pinia
- `apps/mobile/src/utils/convert.ts`
  - function cleanCharacterName
  - function voiceActorToPersonData
  - const actorToPersonData
- `apps/mobile/src/utils/deepLinks.ts`
  - function parseDeepLink: (url) => DeepLink | null
  - function handleDeepLink: (url) => boolean
  - function useDeepLinkHandler: () => void
- `apps/mobile/src/utils/image.ts` — function getAvatarFallbackUrl
- `apps/mobile/src/utils/language.ts` — function getLanguageDisplayName: (langCode, uiLocale) => string
- `apps/website/server/api/movie/[id].get.ts` — function fetchMovieData: (event, movieId) => void
- `apps/website/server/api/show/[id].get.ts` — function fetchShowData: (event, showId) => void
- `apps/website/server/utils/api/advertisement.ts` — class AdvertisementClient
- `apps/website/server/utils/api/igdb.ts`
  - function buildIgdbImageUrl: (hash, size) => string
  - class IgdbClient
  - interface IgdbPopularityPrimitive
- `apps/website/server/utils/api/openlibrary.ts` — function buildOpenLibraryCoverUrl: (coverId, size) => string, class OpenLibraryClient
- `apps/website/server/utils/api/podcast.ts` — class PodcastClient, interface ITunesPodcastResult
- `apps/website/server/utils/api/tmdb.ts` — class TMDBClient
- `apps/website/server/utils/api/toy.ts` — class ToyClient
- `apps/website/server/utils/api/tvdb.ts` — class TVDBClient
- `apps/website/server/utils/auth.ts` — function requireUser: (event) => User, function requireAdmin: (event) => User
- `apps/website/server/utils/background.ts` — function scheduleBackgroundTask: (event, task, label) => void
- `apps/website/server/utils/cache/constants.ts`
  - class SimpleKeyBuilder
  - class SimpleKeyValidator
  - const API_PREFIXES
  - const CACHE_SCHEMA_VERSION
  - const CONTENT_TYPES
  - const CACHE_KEYS
- `apps/website/server/utils/cache/http.ts`
  - function getPublicCacheControl: (profile) => string
  - function setNoCacheHeaders: (event) => void
  - function setNoStoreHeaders: (event) => void
  - function setPublicCacheHeaders: (event, profile) => void
  - type CacheProfile
  - const NO_STORE_CACHE_CONTROL
- `apps/website/server/utils/cache/index.ts`
  - class SimpleCache
  - class FreshCache
  - type CacheTTLPreset
  - const CACHE_TTL
- `apps/website/server/utils/cache/wikipedia.ts`
  - function sortLanguagesByPopularity: (languages) => string[]
  - function extractAvailableLanguages: (sitelinks, {...}) => string[]
  - function cleanHeadingText: (raw) => string
  - function isDubbingSectionHeading: (heading) => boolean
  - function selectDubbingSections: (sections) => Promise<string[]>
  - function filterValidSectionIndexes: (sections, requested) => Promise<number[]>
  - _...4 more_
- `apps/website/server/utils/db/client.ts` — function useSupabaseAdmin: (event?) => SupabaseClient<Database>
- `apps/website/server/utils/db/dubbing-project.ts` — function findOrCreateDubbingProject: (contentId, contentType, language) => Promise<number>
- `apps/website/server/utils/db/queries.ts`
  - function getVoiceActorWithWork: (id) => void
  - function getWorkByActor: (actorId) => void
  - function getDubbingProjects: (contentId, contentType) => void
  - function getWorkVotes: (workIds, userId?) => Promise<
  - function getTopContributors: (limit) => void
- `apps/website/server/utils/error-message.ts` — function getErrorMessage: (error) => string
- `apps/website/server/utils/featureFlags.ts` — function isEnqueueOnNavigateEnabled: () => Promise<boolean>
- `apps/website/server/utils/index.ts`
  - function getCloudflareKv: (event?) => any
  - function useCache: (event?) => SimpleCache
  - function useFreshCache: () => SimpleCache
  - function useTmdbClient: (cache?) => TMDBClient
  - function useTvdbClient: () => TVDBClient
  - function useIgdbClient: (cache?) => IgdbClient
  - _...5 more_
- `apps/website/server/utils/llm.ts`
  - function areAllLlmQuotasExhausted: () => boolean
  - function getLlmQuotaCache: () => void
  - function llmGenerate: (prompt, options?) => Promise<
  - function llmGenerateObject: (prompt, schema, options?) => Promise<
  - function llmVision: (prompt, imageData, mimeType, options?) => Promise<
  - function llmVisionObject: (prompt, imageData, schema, mimeType, options?) => Promise<
- `apps/website/server/utils/normalize.ts` — function normalizeString: (input) => string, function isExploitableVoiceActorName: (input) => boolean
- `apps/website/server/utils/notifications/discord.ts`
  - function normalizeDiscordUrl: (url) => string
  - function buildDiscordEmbed: (title, message, options?) => Record<string, unknown>
  - function sendDiscordAdminNotification: (title, message, options?) => void
  - interface DiscordWebhookOptions
  - type QueueName
  - type DiscordNotificationCategory
- `apps/website/server/utils/notifications/onesignal.ts` — function sendOneSignalNotification: (title, message, options?) => void, interface OneSignalOptions
- `apps/website/server/utils/pagination.ts`
  - function parsePagination: (options) => ParsedPagination
  - function paginateArray: (items, options) => void
  - type PaginationOptions
  - type ParsedPagination
- `apps/website/server/utils/queue-payload.ts`
  - function validateCheckPayload: (payload) => Validated<ValidQueueBase>
  - function validateDiscoveryPayload: (payload) => Validated<ValidQueueBase>
  - function validateExtractPayload: (payload) => Validated<ValidExtractPayload>
  - interface ValidQueueBase
  - interface ValidExtractPayload
  - type QueueMediaType
- `apps/website/server/utils/services/media-preparation.ts`
  - function checkMediaDubbingSections: (options) => Promise<CheckSectionsResult>
  - function checkGameDubbingSections: (options) => Promise<CheckSectionsResult>
  - function extractMediaDubbingCredits: (options) => Promise<ExtractCreditsResult>
  - function extractGameDubbingCredits: (options) => Promise<ExtractCreditsResult>
  - function prepareMedia: (options) => Promise<PrepareMediaResult>
  - function prepareGame: (options) => Promise<PrepareGameResult>
  - _...4 more_
- `apps/website/server/utils/services/media.ts` — class MediaService
- `apps/website/server/utils/services/voice-actor.ts`
  - function upsertVoiceActor: (firstName, lastName) => void
  - function upsertActor: (id, name, profile_path?) => void
  - function upsertStudio: (name, logo_url?) => void
  - function upsertWork: (voiceActorId, contentId, actorId, contentType, language, performance?, characterId?, characterName?) => void
  - function insertVoiceActorAndWork: (firstName, lastName, contentId, actorId, contentType, language, performance?, characterId?, characterName?) => void
- `apps/website/server/utils/urls/supabase.ts` — function buildSupabaseImageUrl: (imagePath, bucket, size) => string | null, function processVoiceActor
- `apps/website/server/utils/urls/tmdb.ts`
  - function buildTmdbImageUrl: (imagePath, size) => string | null
  - function cleanCharacterName
  - function processMedia
  - const TMDB_CONFIG
- `apps/website/src/composables/useContribute.ts` — function fetchRandomTask, function useContribute
- `apps/website/src/composables/useDragScroll.ts` — function useDragScroll: (scrollRef) => void
- `apps/website/src/composables/useReports.ts` — function useReports
- `apps/website/src/composables/useTheme.ts` — function useTheme: () => void
- `apps/website/src/composables/useUrlPagination.ts` — function readUrlPage: (value) => number, function useUrlPagination: (queryKey) => void
- `apps/website/src/lib/media-editor-routes.ts` — function getMediaEditorRoute: ({...}, mediaId, projectId }) => string | null
- `apps/website/src/lib/mediaQueue.ts` — function enqueueMedia: (params) => Promise<void>
- `apps/website/src/utils/media-cast.ts`
  - function sameMediaId: (left, right) => boolean
  - function matchCastWorks: (actors, works) => CastWorkMatchResult<Actor, Work>
  - interface CastActorReference
  - interface CastWorkReference
  - interface CastWorkMatchResult
- `apps/website/src/utils/search-routes.ts` — function getSearchResultRoute: (result, "id" | "media_type">) => string, type SearchFilter
- `e2e/helpers/mock-api.ts`
  - function waitForVueHydration: (page) => Promise<void>
  - function setupMockApi: (page, options) => void
  - interface MockApiOptions
- `packages/og-image/src/index.ts`
  - function generateTemplate: (options) => void
  - interface GenerateOptions
  - type GeneratorType
- `packages/og-image/src/voice-actor.ts` — function voiceActorGenerator: (params) => void, interface VoiceActorOgParams
- `packages/shared-logic/src/composables/useActorData.ts`
  - function fetchActorData: (id) => Promise<ActorDataPayload | null>
  - function useActorData: (initialData?) => void
  - type ActorResponse
  - type ActorDataPayload
- `packages/shared-logic/src/composables/useAdvertisementData.ts` — function fetchAdvertisementData: (id, locale?) => Promise<AdvertisementResponse | null>
- `packages/shared-logic/src/composables/useAudiobookData.ts` — function fetchAudiobookData: (id, locale?) => Promise<AudiobookResponse | null>
- `packages/shared-logic/src/composables/useDetailCollections.ts`
  - function fetchDetailCollection: (params) => Promise<PaginatedResponse<T>>
  - type DetailCollection
  - type DetailCollectionParams
- `packages/shared-logic/src/composables/useEpisodeData.ts` — function fetchEpisodeData: (showId, seasonNumber, episodeNumber, locale?) => Promise<any | null>
- `packages/shared-logic/src/composables/useGameData.ts` — function fetchGameData: (id, locale?) => Promise<any | null>
- `packages/shared-logic/src/composables/useHomeData.ts`
  - function fetchHomeData: (language) => Promise<HomeDataPayload>
  - function useHomeData: (initialData?) => void
  - type HomeDataPayload
- `packages/shared-logic/src/composables/useMovieData.ts` — function fetchMovieData: (id, locale?) => Promise<any | null>
- `packages/shared-logic/src/composables/usePodcastData.ts` — function fetchPodcastData: (id, locale?) => Promise<PodcastResponse | null>
- `packages/shared-logic/src/composables/useSearchData.ts` — function fetchSearchData: (query) => Promise<SearchResult[]>, type SearchResult
- `packages/shared-logic/src/composables/useSeasonData.ts` — function fetchSeasonData: (showId, seasonNumber, locale?) => Promise<any | null>
- `packages/shared-logic/src/composables/useShowData.ts` — function fetchShowData: (id, locale?) => Promise<any | null>
- `packages/shared-logic/src/composables/useStudioData.ts`
  - function fetchStudioDetails: (studioId) => Promise<StudioDetailsResponse | null>
  - function fetchStudiosData: () => Promise<Studio[]>
  - function useStudioData: (initialStudios?, initialStudioDetails?) => void
  - type Studio
  - type StudioDetailsResponse
- `packages/shared-logic/src/composables/useToyData.ts` — function fetchToyData: (id, locale?) => Promise<ToyResponse | null>
- `packages/shared-logic/src/composables/useVoiceActorData.ts`
  - function fetchVoiceActorData: (id, lang?) => Promise<VoiceActorDataPayload | null>
  - function useVoiceActorData: (initialData?) => void
  - type VoiceActorResponse
  - type EnhancedWorkItem
  - type VoiceActorDataPayload
- `packages/shared-logic/src/constants.ts`
  - function resolveLocaleLanguage: (value?) => string | null
  - interface LocaleConfig
  - type SupportedLocale
  - type NonDefaultLocale
  - type MediaType
  - type MediaRoutePrefix
  - _...9 more_
- `packages/shared-logic/src/utils/character.ts` — function normalizeCharacterName, function findCharacter

---

# Config

## Environment Variables

- `ANDROID_HOME` **required** — .env.example
- `CI` **required** — apps/mobile/capacitor.config.ts
- `DEV` **required** — apps/mobile/src/api/supabase.ts
- `DISCORD_ADMIN_WEBHOOK_LOG_URL` **required** — .env.example
- `DISCORD_CHECK_WEBHOOK_URL` **required** — apps/website/server/utils/notifications/discord.ts
- `DISCORD_DISCOVERY_WEBHOOK_URL` **required** — apps/website/server/utils/notifications/discord.ts
- `DISCORD_EXTRACT_WEBHOOK_URL` **required** — apps/website/server/utils/notifications/discord.ts
- `DISCORD_WEBHOOK_CHECK_URL` **required** — apps/website/server/utils/notifications/discord.ts
- `DISCORD_WEBHOOK_DISCOVERY_URL` **required** — apps/website/server/utils/notifications/discord.ts
- `DISCORD_WEBHOOK_EXTRACT_URL` **required** — apps/website/server/utils/notifications/discord.ts
- `DISCORD_WEBHOOK_URL` **required** — apps/website/server/utils/notifications/discord.ts
- `DISCORD_WEBHOOK_URL_1` **required** — apps/website/server/utils/notifications/discord.ts
- `DISCORD_WEBHOOK_URL_2` **required** — apps/website/server/utils/notifications/discord.ts
- `DISCORD_WEBHOOK_URL_3` **required** — apps/website/server/utils/notifications/discord.ts
- `E2E_TEST` **required** — apps/website/server/middleware/00-e2e-mock.ts
- `GEMINI_API_KEY` (has default) — apps/website/server/utils/llm.ts
- `GEMINI_MODELS` **required** — apps/website/server/utils/llm.ts
- `GOOGLE_AI_KEY` **required** — .env.example
- `GROQ_API_KEY` **required** — .env.example
- `GROQ_MODEL` (has default) — apps/website/server/utils/llm.ts
- `IGDB_CLIENT_ID` **required** — .env.example
- `IGDB_CLIENT_SECRET` **required** — .env.example
- `JAVA_HOME` **required** — .env.example
- `JWT_SECRET` (has default) — .env.example
- `KEY_ALIAS` **required** — .env.example
- `KEY_PASSWORD` **required** — .env.example
- `KEYSTORE_PASSWORD` **required** — .env.example
- `LLM_PROVIDER` (has default) — apps/website/server/utils/llm.ts
- `NDK_HOME` **required** — .env.example
- `NITRO_PRESET` (has default) — apps/website/nuxt.config.ts
- `NODE_ENV` (has default) — .env.example
- `NUXT_DISCORD_WEBHOOK_CHECK_URL` **required** — apps/website/server/utils/notifications/discord.ts
- `NUXT_DISCORD_WEBHOOK_DISCOVERY_URL` **required** — apps/website/server/utils/notifications/discord.ts
- `NUXT_DISCORD_WEBHOOK_EXTRACT_URL` **required** — apps/website/server/utils/notifications/discord.ts
- `NUXT_DISCORD_WEBHOOK_URL` **required** — apps/website/server/utils/notifications/discord.ts
- `NUXT_DISCORD_WEBHOOK_URL_1` **required** — apps/website/server/utils/notifications/discord.ts
- `NUXT_DISCORD_WEBHOOK_URL_2` **required** — apps/website/server/utils/notifications/discord.ts
- `NUXT_DISCORD_WEBHOOK_URL_3` **required** — apps/website/server/utils/notifications/discord.ts
- `NUXT_GEMINI_MODELS` (has default) — apps/website/server/utils/llm.ts
- `NUXT_GOOGLE_AI_KEY` **required** — .env.example
- `NUXT_GROQ_API_KEY` **required** — .env.example
- `NUXT_GROQ_MODEL` (has default) — apps/website/server/utils/llm.ts
- `NUXT_LLM_PROVIDER` (has default) — apps/website/server/utils/llm.ts
- `NUXT_PUBLIC_SUPABASE_URL` (has default) — apps/website/server/api/og-image/index.get.ts
- `NUXT_SUPABASE_SECRET_KEY` (has default) — apps/website/server/api/prepare-trending-media.post.ts
- `NUXT_SUPABASE_URL` (has default) — apps/website/server/api/og-image/index.get.ts
- `ONESIGNAL_APP_ID` **required** — .env.example
- `ONESIGNAL_REST_API_KEY` **required** — .env.example
- `RESEND_API_KEY` **required** — .env.example
- `RESEND_FROM_EMAIL` (has default) — .env.example
- `RESEND_TO_EMAIL` (has default) — .env.example
- `SUPABASE_PUBLISHABLE_KEY` **required** — .env.example
- `SUPABASE_SECRET_KEY` **required** — .env.example
- `SUPABASE_URL` (has default) — .env.example
- `TMDB_API_KEY` **required** — .env.example
- `TVDB_API_KEY` **required** — .env.example
- `UPSTASH_REDIS_REST_TOKEN` **required** — .env.example
- `UPSTASH_REDIS_REST_URL` **required** — .env.example
- `VITE_API_BASE_URL` (has default) — .env.example
- `VITE_ONESIGNAL_APP_ID` **required** — .env.example
- `VITE_SUPABASE_PUBLISHABLE_KEY` **required** — .env.example
- `VITE_SUPABASE_URL` (has default) — .env.example
- `WIKI_LANG` (has default) — scripts/discover-media.ts

## Config Files

- `.env.example`
- `apps/mobile/vite.config.ts`

---

# Middleware

## auth
- auth — `apps/mobile/src/stores/auth.ts`
- generate-social-content.post — `apps/website/server/api/generate-social-content.post.ts`
- auth — `apps/website/server/middleware/auth.ts`
- auth — `apps/website/server/utils/auth.ts`
- auth — `apps/website/src/middleware/auth.ts`
- authenticated-fetch — `apps/website/src/plugins/authenticated-fetch.ts`

## custom
- 00-cache — `apps/website/server/middleware/00-cache.ts`
- 00-e2e-mock — `apps/website/server/middleware/00-e2e-mock.ts`
- 01-locale-redirect — `apps/website/server/middleware/01-locale-redirect.ts`
- admin — `apps/website/src/middleware/admin.ts`
- 20260618000000_migrate_to_pgmq — `packages/database/supabase/migrations/20260618000000_migrate_to_pgmq.sql`

## cors
- 01-cors — `apps/website/server/middleware/01-cors.ts`

---

# Dependency Graph

## Most Imported Files (change these carefully)

- `apps/website/server/utils/db/client.ts` — imported by **59** files
- `apps/website/server/utils/cache/http.ts` — imported by **39** files
- `apps/website/server/utils/auth.ts` — imported by **26** files
- `apps/website/server/utils/index.ts` — imported by **23** files
- `apps/website/server/utils/db/queries.ts` — imported by **12** files
- `apps/website/server/utils/notifications/discord.ts` — imported by **11** files
- `apps/website/server/utils/urls/supabase.ts` — imported by **10** files
- `apps/website/server/utils/urls/tmdb.ts` — imported by **10** files
- `apps/website/server/utils/cache/index.ts` — imported by **10** files
- `apps/website/server/utils/api/igdb.ts` — imported by **8** files
- `e2e/helpers/mock-api.ts` — imported by **8** files
- `packages/shared-logic/src/types/index.ts` — imported by **8** files
- `apps/website/server/utils/background.ts` — imported by **7** files
- `apps/website/server/utils/services/media.ts` — imported by **6** files
- `apps/website/server/utils/error-message.ts` — imported by **5** files
- `apps/website/server/utils/llm.ts` — imported by **4** files
- `apps/website/server/utils/db/dubbing-project.ts` — imported by **3** files
- `apps/website/server/utils/normalize.ts` — imported by **3** files
- `apps/mobile/src/api/supabase.ts` — imported by **2** files
- `apps/mobile/src/views/voice-actor-profile.vue` — imported by **2** files

## Import Map (who imports what)

- `apps/website/server/utils/db/client.ts` ← `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/cast-vote.post.ts`, `apps/website/server/api/count-voice-actor-works.post.ts` +54 more
- `apps/website/server/utils/cache/http.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/dashboard-stats.get.ts` +34 more
- `apps/website/server/utils/auth.ts` ← `apps/website/server/api/create-user-profile.post.ts`, `apps/website/server/api/dashboard-stats.get.ts`, `apps/website/server/api/delete-voice-actor-link.post.ts`, `apps/website/server/api/delete-work-entry.post.ts`, `apps/website/server/api/delete_user.post.ts` +21 more
- `apps/website/server/utils/index.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/episode/index.get.ts` +18 more
- `apps/website/server/utils/db/queries.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/episode/index.get.ts`, `apps/website/server/api/game/[id].get.ts` +7 more
- `apps/website/server/utils/notifications/discord.ts` ← `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/game/[id].get.ts`, `apps/website/server/api/media-queue.post.ts`, `apps/website/server/api/movie/[id].get.ts` +6 more
- `apps/website/server/utils/urls/supabase.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/dashboard-stats.get.ts`, `apps/website/server/api/find_duplicate_voice_actors.get.ts`, `apps/website/server/api/recent-voice-actors.get.ts`, `apps/website/server/api/search/index.get.ts` +5 more
- `apps/website/server/utils/urls/tmdb.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/movie/[id].get.ts`, `apps/website/server/api/notify-subscribers.post.ts`, `apps/website/server/api/prepare-trending-media.post.ts`, `apps/website/server/api/search/index.get.ts` +5 more
- `apps/website/server/utils/cache/index.ts` ← `apps/website/server/utils/api/igdb.ts`, `apps/website/server/utils/api/openlibrary.ts`, `apps/website/server/utils/api/podcast.ts`, `apps/website/server/utils/api/tmdb.ts`, `apps/website/server/utils/api/tvdb.ts` +5 more
- `apps/website/server/utils/api/igdb.ts` ← `apps/website/server/api/game/[id].get.ts`, `apps/website/server/api/internal-media-credits.get.ts`, `apps/website/server/api/internal-media-metadata.get.ts`, `apps/website/server/api/search/index.get.ts`, `apps/website/server/api/trending/games.get.ts` +3 more

---

# Test Coverage

> **5%** of routes and models are covered by tests
> 32 test files found

## Covered Routes

- GET:/api/detail-collections

## Covered Models

- voice_actors
- source
- work
- studios

---

# CI/CD Pipelines

## GitHub Actions (2 workflows)

| Workflow | Triggers | Jobs | Deploy | Environments |
|---|---|---|---|---|
| codesight | push, workflow_dispatch | 1 | — | — |
| Release and Deployment Pipeline | push, workflow_dispatch | 10 | netlify, cloudflare | — |

### Release and Deployment Pipeline

> `.github/workflows/pipeline.yml`

> Concurrency: `${{ github.workflow }}-${{ github.ref }}`

- **detect** on `ubuntu-latest` — 2 steps
  - `actions/checkout@v4`
  - `dorny/paths-filter@v3`
- **deploy-supabase** on `ubuntu-latest` — 8 steps (needs: detect)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
  - `denoland/setup-deno@v2.0.5`
  - `supabase/setup-cli@v3`
- **e2e-tests** on `ubuntu-latest` — 7 steps (needs: detect, deploy-supabase)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
  - `jdx/mise-action@v2`
- **frontend-tests** on `ubuntu-latest` — 5 steps (needs: detect)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
- **i18n-check** on `ubuntu-latest` — 5 steps (needs: detect)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
- **deploy-mobile-web** on `ubuntu-latest` — 6 steps (needs: detect, deploy-supabase, e2e-tests, frontend-tests, i18n-check) → **netlify**
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
  - `nwtgck/actions-netlify@v3.0`
- **build-android** on `ubuntu-latest` — 12 steps (needs: detect, deploy-supabase, e2e-tests, frontend-tests, i18n-check)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
  - `actions/setup-java@v4`
  - `android-actions/setup-android@v3`
  - `actions/upload-artifact@v4`
  - `actions/upload-artifact@v4`
- **upload-play-store** on `ubuntu-latest` — 3 steps (needs: detect, build-android)
  - `actions/checkout@v4`
  - `actions/download-artifact@v4`
  - `KevinRohn/github-action-upload-play-store@v1.0.1`
- **build-website** on `ubuntu-latest` — 5 steps (needs: detect, deploy-supabase, e2e-tests, frontend-tests, i18n-check)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
- **deploy-website** on `ubuntu-latest` — 7 steps (needs: detect, deploy-supabase, e2e-tests, frontend-tests) → **cloudflare**
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`

### Secrets

- `ADMIN_EMAIL`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `GITHUB_TOKEN`
- `IGDB_CLIENT_ID`
- `IGDB_CLIENT_SECRET`
- `KEYSTORE_FILE`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_MOBILE_SITE_ID`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_TO_EMAIL`
- `SERVICE_ACCOUNT_JSON`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_URL`
- `TMDB_API_KEY`
- `TVDB_API_KEY`

---
_Source: .github/workflows/codesight.yml, .github/workflows/pipeline.yml_
_Generated by codesight-cicd-plugin_

---

# Git Hooks

> **Note for agents:** These hooks fire automatically on git operations and will block the operation if they fail.

## `pre-commit` — husky

- **mise**: `mise run format-staged`

_Source: .husky/pre-commit_

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_