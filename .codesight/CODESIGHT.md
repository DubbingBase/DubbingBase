# dubbing-base-monorepo — AI Context Map

> **Stack:** nuxt | none | vue | typescript
> **Monorepo:** @app/website, @app/supabase, @app/locales, @app/og-image, @app/shared-logic

> 93 routes | 28 models | 138 components | 126 lib files | 64 env vars | 15 middleware | 52% test coverage
> **Token savings:** this file is ~18,600 tokens. Without it, AI exploration would cost ~158,200 tokens. **Saves ~139,600 tokens per conversation.**
> **Last scanned:** 2026-11-09 09:56 — re-run after significant changes

---

# Routes

- `GET` `/api/about-preference` ✓
- `GET` `/api/actor/:id` params(id) [auth, cache]
- `GET` `/api/admin/dubbing-project` [auth] ✓
- `POST` `/api/admin/dubbing-project` [auth] ✓
- `POST` `/api/admin/queue/clear` [auth, queue]
- `DELETE` `/api/admin/queue/item` [auth, queue]
- `POST` `/api/admin/queue/reprocess-legacy-wiki-check-reviews` [auth] ✓
- `GET` `/api/admin/queue` [auth, queue]
- `POST` `/api/admin/work-duplicates/merge` [auth]
- `GET` `/api/admin/work-duplicates` [auth, cache]
- `GET` `/api/advertisement/:id` params(id) [queue]
- `GET` `/api/audiobook/:id` params(id) [queue]
- `GET` `/api/career-grid`
- `POST` `/api/cast-vote` [auth] ✓
- `GET` `/api/character/:source/:id` params(source, id)
- `GET` `/api/character-images` [cache] ✓
- `POST` `/api/count-voice-actor-works` ✓
- `POST` `/api/create-user-profile` [auth, db]
- `GET` `/api/dashboard-stats` [auth]
- `POST` `/api/delete-user-voice-actor-link` [auth] ✓
- `POST` `/api/delete-voice-actor-link` [auth] ✓
- `POST` `/api/delete_user` [auth]
- `GET` `/api/detail-collections` ✓
- `GET` `/api/episode/index`
- `POST` `/api/extract-credits-from-image` [upload]
- `POST` `/api/extract-voice-actor-info` [auth] ✓
- `GET` `/api/find_duplicate_voice_actors` [auth] ✓
- `GET` `/api/game/:id` params(id)
- `PUT` `/api/game-characters/:id` params(id) [auth]
- `POST` `/api/game-characters` [auth] ✓
- `POST` `/api/generate-social-content` [auth, email]
- `GET` `/api/get-dubbing-project`
- `GET` `/api/get-media-credits` [cache]
- `GET` `/api/get-metadata`
- `GET` `/api/get-random-task` ✓
- `POST` `/api/get-random-task` [auth] ✓
- `GET` `/api/get-studio-details` ✓
- `GET` `/api/get-user-profile` [auth]
- `ALL` `/api/get-user-voice-actor` [auth]
- `GET` `/api/get-user-voice-actors` [auth]
- `GET` `/api/get-work-votes` [auth]
- `GET` `/api/home-stats`
- `POST` `/api/internal-media-create` [auth] ✓
- `GET` `/api/internal-media-credits` ✓
- `GET` `/api/internal-media-metadata`
- `POST` `/api/link-user-voice-actor` [auth] ✓
- `POST` `/api/link-voice-actor` [auth] ✓
- `GET` `/api/list-voice-actors`
- `GET` `/api/list_users` [auth]
- `POST` `/api/manage-subscription` [auth, db] ✓
- `GET` `/api/media-catalog` [db]
- `POST` `/api/media-queue` [auth, queue] ✓
- `POST` `/api/merge_voice_actor_duplicates` [auth]
- `GET` `/api/movie/:id` params(id) [queue]
- `POST` `/api/notify-subscribers` [auth, webhook]
- `GET` `/api/og-image/index` [cache]
- `GET` `/api/podcast/:id` params(id) [queue]
- `POST` `/api/prepare-trending-media` [auth, queue]
- `POST` `/api/prepare_game` [auth] ✓
- `POST` `/api/prepare_media` [auth]
- `POST` `/api/process-credits` [auth, db]
- `POST` `/api/process-media-queue` [auth, cache, queue] ✓
- `GET` `/api/recent-voice-actors`
- `POST` `/api/request-voice-actor-page` [auth, email]
- `POST` `/api/revert-task` [auth, db]
- `POST` `/api/save-dubbing-project` [auth] ✓
- `POST` `/api/save-metadata` [auth] ✓
- `POST` `/api/save-studio` [auth] ✓
- `POST` `/api/save-toy-metadata` [auth] ✓
- `GET` `/api/search/index` [db]
- `GET` `/api/search-voice-actors`
- `GET` `/api/season/index`
- `GET` `/api/show/:id` params(id) [queue]
- `POST` `/api/submit-task` [auth, db, upload] ✓
- `POST` `/api/submit-user-report` [auth, db] ✓
- `GET` `/api/top-contributors` ✓
- `GET` `/api/top-voice-actors` ✓
- `GET` `/api/toy/:id` params(id) [queue]
- `GET` `/api/toy-metadata/:id` params(id)
- `GET` `/api/trending/games` [cache]
- `GET` `/api/trending/movies` [cache] ✓
- `GET` `/api/trending/shows` [cache]
- `GET` `/api/trending/voice-actors`
- `POST` `/api/update-review-status` [auth] ✓
- `POST` `/api/update-user-profile` [auth]
- `POST` `/api/update-voice-actor` [auth, upload] ✓
- `POST` `/api/update_user_role` [auth]
- `POST` `/api/update_voice_actor_link` [auth] ✓
- `POST` `/api/upload-profile-picture` [auth, db, upload] ✓
- `GET` `/api/voice-actor/:id` params(id)
- `ALL` `/routes/sitemap.xml`
- `GET` `/routes/sitemaps/:file` params(file)
- `ALL` `/routes/sitemaps/pages.xml`

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

### dubbing_languages
- code: text (pk)

### dubbing_language_reviews
- id: bigint (pk)
- decision: jsonb (required)
- source_snapshot: jsonb (required)
- target_snapshot: jsonb
- applied_at: timestamp(tz) (required)

### legacy_wiki_check_reprocesses
- archived_msg_id: bigint (pk, fk)
- tmdb_id: bigint (required, fk)
- outcome: text (required)
- queued_msg_id: bigint (required, fk)
- processed_at: timestamp(tz) (required)

### metadata_write_requests
- actor_id: uuid (required, fk)
- request_id: uuid (required, fk)
- entity_type: text (required)
- payload_fingerprint: text (required)
- entity_id: text (required, fk)
- audit_log_id: uuid (required, fk)
- result: jsonb (required)

### voice_actor_write_requests
- actor_id: uuid (required, fk)
- request_id: uuid (required, fk)
- voice_actor_id: bigint (required, fk)
- payload_fingerprint: text (required)
- audit_log_id: uuid (fk)
- result: jsonb (required)

### regional_assignment_requests
- actor_id: uuid (required, fk)
- request_id: uuid (required, fk)
- request_fingerprint: text (required)
- result_project_id: bigint (required, fk)
- metadata: jsonb (required)

### regional_assignment_request_audits
- actor_id: uuid (required, fk)
- request_id: uuid (required, fk)
- audit_log_id: uuid (required, fk)
- metadata: jsonb (required)

### toy_metadata
- content_id: bigint (pk, fk)
- name: text (required)
- manufacturer: text check (manufacturer is
- product_line: text check (product_line is
- release_year: integer check (release_year is
- cover_url: text check (
    cover_url is

### gamification_task_submission_results
- claim_id: uuid (pk, fk)
- user_id: uuid (required, fk)
- submission_fingerprint: text (required)
- points_awarded: integer (required)

### admin_credit_import_requests
- admin_id: uuid (required, fk)
- request_id: uuid (required, fk)
- request_fingerprint: text (required)
- result: jsonb (required)

### user_voice_actor_link_requests
- actor_id: uuid (required, fk)
- request_id: uuid (required, fk)
- operation: text (required)
- payload_fingerprint: text (required)
- target_user_id: uuid (required, fk)
- voice_actor_id: integer (required, fk)
- expected_link_id: uuid (fk)
- result_link_id: uuid (fk)
- result_changed: boolean
- audit_log_id: uuid (fk)
- completed_at: timestamp(tz)

### game_characters
- id: uuid (pk)
- igdb_game_id: bigint (required, fk)
- name: text (required)
- igdb_character_id: bigint check (igdb_character_id is (fk)
- wikidata_qid: text check (
    wikidata_qid is
- created_by: uuid (required)
- updated_by: uuid (required)

---

# Components

- **app** [client] — `apps/website/src/app.vue`
- **AppChip** [client] — props: tone, size, dashed, uppercase — `apps/website/src/components/AppChip.vue`
- **AppFilterChip** [client] — props: selected, to, dashed, size — `apps/website/src/components/AppFilterChip.vue`
- **CharacterPhoto** [client] — props: image — `apps/website/src/components/CharacterPhoto.vue`
- **Footer** [client] — `apps/website/src/components/Footer.vue`
- **ForceEnqueueButton** [client] — props: mediaType, mediaId, seasonNumber, episodeNumber, wikipediaLanguage — `apps/website/src/components/ForceEnqueueButton.vue`
- **Header** [client] — `apps/website/src/components/Header.vue`
- **HeaderPreferenceSelects** [client] — props: initialOpen — `apps/website/src/components/HeaderPreferenceSelects.vue`
- **HeaderPreferences** [client] — `apps/website/src/components/HeaderPreferences.vue`
- **HomeBelowFoldSections** [client] — `apps/website/src/components/HomeBelowFoldSections.vue`
- **LanguageBanner** [client] — `apps/website/src/components/LanguageBanner.vue`
- **MediaCatalogPage** [client] — props: type — `apps/website/src/components/MediaCatalogPage.vue`
- **MediaSkeleton** [client] — `apps/website/src/components/MediaSkeleton.vue`
- **PaginatedResponsiveGrid** [client] — props: items, pageSize, totalItems, page, gridClass, itemKey — `apps/website/src/components/PaginatedResponsiveGrid.vue`
- **PaginationControls** [client] — props: page, totalItems, pageSize — `apps/website/src/components/PaginationControls.vue`
- **PersonSkeleton** [client] — `apps/website/src/components/PersonSkeleton.vue`
- **PwaLifecycleBanner** [client] — `apps/website/src/components/PwaLifecycleBanner.vue`
- **ReportModal** [client] — props: open, targetUrl — `apps/website/src/components/ReportModal.vue`
- **SearchFilters** [client] — props: modelValue — `apps/website/src/components/SearchFilters.vue`
- **SearchResultItem** [client] — props: result, mediaTypeLabel, selected, disabled — `apps/website/src/components/SearchResultItem.vue`
- **UnderConstruction** [client] — `apps/website/src/components/UnderConstruction.vue`
- **AsyncAutocomplete** [client] — props: modelValue, options, loading, placeholder, ariaLabel, disabled, allowCreate, displayFn, searchFn — `apps/website/src/components/admin/AsyncAutocomplete.vue`
- **CastAvatar** [client] — props: name — `apps/website/src/components/admin/CastAvatar.vue`
- **CastRoleSummary** [client] — props: row — `apps/website/src/components/admin/CastRoleSummary.vue`
- **CreateStudioDialog** [client] — props: open, initialName, create — `apps/website/src/components/admin/CreateStudioDialog.vue`
- **CreateVoiceActorDialog** [client] — props: open, initialQuery, status — `apps/website/src/components/admin/CreateVoiceActorDialog.vue`
- **EditorHero** [client] — props: title, eyebrow, backTo, backLabel, posterUrl, chips — `apps/website/src/components/admin/EditorHero.vue`
- **EditorSaveBar** [client] — props: status, isDirty, errorMessage, saveLabel, formId, disabled — `apps/website/src/components/admin/EditorSaveBar.vue`
- **EditorTabs** [client] — props: items — `apps/website/src/components/admin/EditorTabs.vue`
- **FormCard** [client] — props: title — `apps/website/src/components/admin/FormCard.vue`
- **FormField** [client] — props: label — `apps/website/src/components/admin/FormField.vue`
- **LanguageSelect** [client] — props: id — `apps/website/src/components/admin/LanguageSelect.vue`
- **ProjectCastWorkspace** [client] — props: rows, selectedKey — `apps/website/src/components/admin/ProjectCastWorkspace.vue`
- **UnsavedChangesDialog** [client] — props: open — `apps/website/src/components/admin/UnsavedChangesDialog.vue`
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
- **MediaDetailsLayout** [client] — props: shareDub, title, backdropUrl, posterUrl, loading — `apps/website/src/components/layout/MediaDetailsLayout.vue`
- **PersonDetailsLayout** [client] — props: name, profileUrl, backdropUrl, loading — `apps/website/src/components/layout/PersonDetailsLayout.vue`
- **DetailsActionBar** [client] — `apps/website/src/components/layout/details/DetailsActionBar.vue`
- **DetailsActionButton** [client] — props: to, hover, tone — `apps/website/src/components/layout/details/DetailsActionButton.vue`
- **DetailsBackLink** [client] — props: to — `apps/website/src/components/layout/details/DetailsBackLink.vue`
- **DetailsCastHeader** [client] — props: title, subtitle, searchable, placeholder — `apps/website/src/components/layout/details/DetailsCastHeader.vue`
- **DetailsCrewCard** [client] — props: title, crew — `apps/website/src/components/layout/details/DetailsCrewCard.vue`
- **DetailsDubTabs** [client] — props: projects, activeId, languageLabel, count, original — `apps/website/src/components/layout/details/DetailsDubTabs.vue`
- **DetailsEditLink** [client] — props: to — `apps/website/src/components/layout/details/DetailsEditLink.vue`
- **DetailsEmptyState** [client] — `apps/website/src/components/layout/details/DetailsEmptyState.vue`
- **DetailsExternalLink** [client] — props: href — `apps/website/src/components/layout/details/DetailsExternalLink.vue`
- **DetailsHero** [client] — props: title, backdropUrl, blurBackdrop, imageUrl, imageAspectRatio — `apps/website/src/components/layout/details/DetailsHero.vue`
- **DetailsMetaChip** [client] — props: variant, label, href — `apps/website/src/components/layout/details/DetailsMetaChip.vue`
- **DetailsPage** [client] — `apps/website/src/components/layout/details/DetailsPage.vue`
- **DetailsReportButton** [client] — `apps/website/src/components/layout/details/DetailsReportButton.vue`
- **DetailsShareButton** [client] — props: title, dub, keepQuery — `apps/website/src/components/layout/details/DetailsShareButton.vue`
- **DetailsStudioLink** [client] — props: studio — `apps/website/src/components/layout/details/DetailsStudioLink.vue`
- **DetailsSynopsis** [client] — props: text — `apps/website/src/components/layout/details/DetailsSynopsis.vue`
- **DetailsVoiceCastCard** [client] — props: item — `apps/website/src/components/layout/details/DetailsVoiceCastCard.vue`
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
- **advertisements** [client] — `apps/website/src/pages/advertisements.vue`
- **edit** [client] — `apps/website/src/pages/audiobook/[audiobookId]/projects/[projectId]/edit.vue`
- **new** [client] — `apps/website/src/pages/audiobook/[audiobookId]/projects/new.vue`
- **[id]** [client] — `apps/website/src/pages/audiobook/[id].vue`
- **audiobooks** [client] — `apps/website/src/pages/audiobooks.vue`
- **[id]** [client] — `apps/website/src/pages/character/[source]/[id].vue`
- **index** [client] — `apps/website/src/pages/contribute/index.vue`
- **play** [client] — `apps/website/src/pages/contribute/task/play.vue`
- **discussions** [client] — `apps/website/src/pages/discussions.vue`
- **edit** [client] — `apps/website/src/pages/game/[gameId]/projects/[projectId]/edit.vue`
- **new** [client] — `apps/website/src/pages/game/[gameId]/projects/new.vue`
- **[id]** [client] — `apps/website/src/pages/game/[id].vue`
- **games** [client] — `apps/website/src/pages/games.vue`
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
- **podcasts** [client] — `apps/website/src/pages/podcasts.vue`
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
- **toys** [client] — `apps/website/src/pages/toys.vue`
- **[id]** [client] — `apps/website/src/pages/voice-actor/[id].vue`
- **edit** [client] — `apps/website/src/pages/voice-actor/[voiceActorId]/edit.vue`
- **new** [client] — `apps/website/src/pages/voice-actor/new.vue`
- **voice-actors** [client] — `apps/website/src/pages/voice-actors.vue`

---

# Libraries

- `apps/website/server/api/movie/[id].get.ts` — function fetchMovieData: (event, movieId) => void
- `apps/website/server/api/show/[id].get.ts` — function fetchShowData: (event, showId) => void
- `apps/website/server/api/trending/games.get.ts` — function getTrendingGamesResponse: (event, language, config, igdbClient, language?) => Promise<IgdbTrendingGamesResult>;
- `apps/website/server/utils/actor-page-response.ts`
  - function pickTrendingBackdropPath: (creditGroups) => string | null
  - function actorPageResponse: (actor, unknown>, actorCredits, unknown>[], voiceRoles, profilePath, backdropPath, options?) => void
  - type ActorPageVoiceRole
- `apps/website/server/utils/api/advertisement.ts` — class AdvertisementClient
- `apps/website/server/utils/api/igdb.ts`
  - function buildIgdbImageUrl: (hash, size) => string
  - function isIgdbGame: (value) => value is IgdbGame
  - function isIgdbCharacter: (value) => value is IgdbCharacter
  - class IgdbClient
  - interface IgdbTrendingGamesResult
  - interface IgdbPopularityPrimitive
- `apps/website/server/utils/api/openlibrary.ts` — function buildOpenLibraryCoverUrl: (coverId, size) => string, class OpenLibraryClient
- `apps/website/server/utils/api/podcast.ts` — class PodcastClient, interface ITunesPodcastResult
- `apps/website/server/utils/api/tmdb.ts` — class TMDBClient
- `apps/website/server/utils/api/toy.ts` — class ToyClient
- `apps/website/server/utils/api/tvdb.ts` — class TVDBClient, const TVDB_AUTH_TOKEN_NAMESPACE
- `apps/website/server/utils/auth-handlers.ts` — function defineUserHandler: (handler, user) => void, function defineAdminHandler: (handler, admin) => void
- `apps/website/server/utils/auth-session.ts` — function hasSupabaseAuthCookie: (cookieHeader, cookiePrefix) => boolean
- `apps/website/server/utils/auth.ts`
  - function resolveUser: (event) => Promise<User | null>
  - function requireUser: (event) => Promise<User>
  - function requireAdmin: (event) => Promise<User>
- `apps/website/server/utils/background.ts` — function scheduleBackgroundTask: (event, task, label) => void
- `apps/website/server/utils/cache/constants.ts`
  - function hashCacheValue: (value) => string
  - function buildCacheKey: (input) => string
  - class SimpleKeyValidator
  - interface CacheKeyInput
  - const CACHE_SCHEMA_VERSION
- `apps/website/server/utils/cache/http.ts`
  - function getPublicCacheControl: (profile) => string
  - function getCloudflareCacheControl: (profile) => string
  - function setNoCacheHeaders: (event) => void
  - function setPublicCacheHeaders: (event, profile) => void
  - type CacheProfile
  - const NO_STORE_CACHE_CONTROL
- `apps/website/server/utils/cache/index.ts`
  - function createCacheNamespace: () => CacheNamespace<T>
  - class CacheNamespace
  - class SimpleCache
  - interface CacheKv
  - type CachePolicy
  - type CacheTTLPreset
  - _...2 more_
- `apps/website/server/utils/cache/public-pages.ts`
  - function isPublicCacheablePage: (pathname) => boolean
  - function shouldCachePublicPage: (request) => boolean
  - interface PublicPageRequest
- `apps/website/server/utils/cache/response-policy.ts`
  - function resolveCacheDecision: (input) => CacheDecision
  - function applyDefaultCachePolicy: (event) => void
  - function applyCachePolicy: (event, options) => void
  - interface CacheDecisionInput
  - type CacheDecision
- `apps/website/server/utils/cache/wikipedia.ts`
  - function sortLanguagesByPopularity: (languages) => string[]
  - function extractAvailableLanguages: (sitelinks, {...}) => string[]
  - function cleanHeadingText: (raw) => string
  - function isDubbingSectionHeading: (heading) => boolean
  - function selectDubbingCandidateSections: (sections) => Promise<DubbingSectionCandidate[]>
  - function selectDubbingSections: (sections) => Promise<string[]>
  - _...6 more_
- `apps/website/server/utils/character-images.ts`
  - function isCharacterImageSource: (value) => value is CharacterImageSource
  - function selectTvdbCharacter: (names, characters) => void
  - function resolveCharacterImage: (resolvers, skip, onError?, error) => void
  - type CharacterImageSource
  - type CharacterImage
  - type CharacterImageResolver
  - _...1 more_
- `apps/website/server/utils/contribution/task-submission-validation.ts`
  - function isTaskClaimId: (value) => value is string
  - function authorizeTaskContribution: (input) => void
  - function validateTaskContribution: (input) => TaskContribution
  - type TaskCategory
  - type TaskUpload
  - type TaskContributionInput
  - _...1 more_
- `apps/website/server/utils/db/client.ts` — function useSupabaseAdmin: (event?) => SupabaseClient<Database>
- `apps/website/server/utils/db/dubbing-project.ts` — function findOrCreateDubbingProject: (contentId, contentType, dubbingLanguage, actorId, voiceActorId, requestId) => Promise<number>
- `apps/website/server/utils/db/queries.ts`
  - function getVoiceActorWithWork: (id) => void
  - function getWorkByActor: (actorId) => void
  - function getActorPageWorkByActor: (actorId) => void
  - function getDubbingProjects: (contentId, contentType) => void
  - function getDubbingProjectsForMediaEndpoint: (contentId, contentType, projection) => void
  - function getAdvertisementPageDubbingProjects: (contentId) => void
  - _...11 more_
- `apps/website/server/utils/dubbing-language.ts` — function requireDubbingLanguage: (value) => DubbingLanguage
- `apps/website/server/utils/dubbing-region-detection.ts` — function detectDubbingRegionFromWikitext: ({...}, sections, }) => DubbingEvidence, type DubbingEvidence
- `apps/website/server/utils/error-message.ts` — function getErrorMessage: (error) => string
- `apps/website/server/utils/featureFlags.ts` — function isEnqueueOnNavigateEnabled: () => Promise<boolean>
- `apps/website/server/utils/game-character-validation.ts`
  - function gameCharacterError: (statusCode, message) => void
  - function hasOnlyKeys: (value, unknown>, allowed) => void
  - function isUuid: (value) => value is string
- `apps/website/server/utils/game-characters.ts`
  - function mergeGameCharacters: (igdbCharacters, localCharacters) => ResolvedGameCharacter[]
  - function loadGameCharacterCatalog: (event, gameId, loadIgdbCharacters) => void
  - interface ResolvedGameCharacter
- `apps/website/server/utils/global-env.ts`
  - function toStringRecord: (value) => Record<string, string | undefined>
  - function getGlobalEnv: () => Record<string, string | undefined>
  - function getCloudflareEnv: (event) => Record<string, string | undefined>
- `apps/website/server/utils/index.ts`
  - function getCloudflareKv: (event?) => CacheKv | null
  - function useCache: (event?) => SimpleCache
  - function useTmdbClient: () => TMDBClient
  - function useTvdbClient: () => TVDBClient
  - function useIgdbClient: (cache?) => IgdbClient
  - function useOpenLibraryClient: () => OpenLibraryClient
  - _...4 more_
- `apps/website/server/utils/llm.ts`
  - function areAllLlmQuotasExhausted: () => boolean
  - function getLlmQuotaCache: () => void
  - function llmGenerate: (prompt, options?) => Promise<
  - function llmGenerateObject: (prompt, schema, options?) => Promise<
  - function llmVision: (prompt, imageData, mimeType, options?) => Promise<
  - function llmVisionObject: (prompt, imageData, schema, mimeType, options?) => Promise<
- `apps/website/server/utils/media-page-credits.ts` — function mediaPageMovieCredits: (credits) => void, function mediaPageAggregateCredits: (credits) => void
- `apps/website/server/utils/media-queue-readiness.ts`
  - function getReadyMediaQueueNames: (value) => MediaQueueName[]
  - type MediaQueueName
  - const mediaQueueNames
- `apps/website/server/utils/media-request.ts`
  - function parseSeasonQuery: (query, unknown>) => void
  - function parseEpisodeQuery: (query, unknown>) => void
  - function toMediaServiceError: (error, dependency) => void
  - function withMediaServiceTimeout: (request) => void
- `apps/website/server/utils/narrow.ts` — function asString: (value) => string | undefined
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
- `apps/website/server/utils/prepare-payload.ts`
  - function validatePrepareGamePayload: (payload) => Validated<PrepareGameInput>
  - function prepareGameFromPayload: (payload, prepare) => void
  - function validatePrepareMediaPayload: (payload) => Validated<PrepareMediaInput>
  - interface PrepareGameInput
  - interface PrepareMediaInput
- `apps/website/server/utils/profile-validation.ts`
  - function parseOptionalText: (value, field, maxLength) => string | null | undefined
  - function parseOptionalDate: (value) => string | null | undefined
  - const maxBioLength
  - const maxNationalityLength
- `apps/website/server/utils/queue-payload.ts`
  - function queueRequester: (value) => string | null
  - function queueRequesterRpcArgs: (value) => void
  - function validateDiscoveryPayload: (payload) => Validated<ValidQueueBase>
  - function validateCheckPayload: (payload) => Validated<ValidCheckPayload>
  - function validateExtractPayload: (payload) => Validated<ValidExtractPayload>
  - interface ValidQueueBase
  - _...3 more_
- `apps/website/server/utils/retryable-request.ts`
  - function isRetryableMediaRequestError: (error) => error is RetryableMediaRequestError
  - function isRetryableMediaRequestStatus: (status) => boolean
  - function createMediaResponseError: (provider, response) => Error
  - function fetchMediaRequest: (input, init?) => Promise<Response>
  - class RetryableMediaRequestError
- `apps/website/server/utils/search-ranking.ts`
  - function rankSearchResults: (items) => SearchItem[]
  - function getTmdbLocale: (locale) => string
  - function projectSearchResult: (item) => SearchItem
  - type SearchItem
  - const MEDIA_TYPE_WEIGHTS: Readonly<Record<string, number>>
  - const DEFAULT_MEDIA_TYPE_WEIGHT
  - _...1 more_
- `apps/website/server/utils/services/media-preparation.ts`
  - function checkMediaDubbingSections: (options) => Promise<CheckSectionsResult>
  - function checkGameDubbingSections: (options) => Promise<CheckSectionsResult>
  - function extractMediaDubbingCredits: (options) => Promise<ExtractCreditsResult>
  - function extractGameDubbingCredits: (options) => Promise<ExtractCreditsResult>
  - function prepareMedia: (options) => Promise<PrepareMediaResult>
  - function prepareGame: (options) => Promise<PrepareGameResult>
  - _...4 more_
- `apps/website/server/utils/services/media.ts`
  - class MediaService
  - const VOICE_ACTOR_PAGE_TMDB_MEDIA_NAMESPACE
  - const VOICE_ACTOR_PAGE_TMDB_BACKDROP_NAMESPACE
  - const WIKIPEDIA_ACTOR_URL_NAMESPACE
  - const MEDIA_TVDB_CHARACTERS_NAMESPACE
- `apps/website/server/utils/services/voice-actor.ts`
  - function applyExtractedCredits: (contentId, contentType, dubbingLanguage, credits) => Promise<AppliedExtractedCredits>
  - function upsertStudio: (name, logo_url?) => void
  - interface ExtractedCredit
  - interface AppliedExtractedCredits
- `apps/website/server/utils/services/wiki-extraction-batching.ts`
  - function buildWikipediaExtractionBatches: (sections, maxPromptChars) => WikipediaExtractionBatch[]
  - function deduplicateExtractedCredits: (credits) => ExtractedCredit[]
  - interface WikipediaExtractionSection
  - interface WikipediaExtractionBatch
  - const MAX_WIKIPEDIA_EXTRACTION_PROMPT_CHARS
- `apps/website/server/utils/services/wiki-extraction-sections.ts`
  - function getValidatedExtractionSections: (options) => Promise<ValidatedExtractionSections>
  - interface ScanSectionMetadata
  - type ValidatedExtractionSections
- `apps/website/server/utils/services/wikimedia-character-image.ts`
  - function getWikimediaCharacterImage: (input) => Promise<WikimediaCharacterImage | null>
  - type WikimediaCharacterImage
  - const WIKIMEDIA_CHARACTER_IMAGE_NAMESPACE
- `apps/website/server/utils/sitemap-data.ts` — function listSitemapChunks: (event) => Promise<, function loadSitemapChunk: (event, name, chunk) => Promise<SitemapRecord[]>
- `apps/website/server/utils/sitemap-response.ts` — function getSitemapOrigin: (event) => string, function sendSitemapXml: (event, xml) => string
- `apps/website/server/utils/sitemap.ts`
  - function localizedPath: (localeCode, path) => string
  - function renderUrlset: (origin, records) => Promise<string>
  - function renderSitemapIndex: (origin, sitemaps) => Promise<string>
  - function chunkCount: (totalRecords) => number
  - interface SitemapEntity
  - interface SitemapRecord
  - _...3 more_
- `apps/website/server/utils/testing/supabase-server-stub.ts` — function serverSupabaseClient: () => Promise<never>
- `apps/website/server/utils/urls/supabase.ts`
  - function buildSupabaseImageUrl: (imagePath, bucket, _size) => string | null
  - const withVoiceActorImageUrl
  - const processVoiceActor
- `apps/website/server/utils/urls/tmdb.ts`
  - function buildTmdbImageUrl: (imagePath, size) => string | null
  - function cleanCharacterName
  - const TMDB_CONFIG
  - const withTmdbImageUrls
  - const processMedia
- `apps/website/server/utils/voice-actor-record.ts` — function isVoiceActorRecord: (value) => value is VoiceActorRecord, type VoiceActorRecord
- `apps/website/server/utils/wiki-check-disposition.ts`
  - function wikiCheckDisposition: (evidence, candidateSectionIndexes, requestedLanguage?) => WikiCheckDisposition
  - type WikiCheckArchiveReason
  - type WikiCheckSkippedResult
  - type WikiCheckDisposition
- `apps/website/server/utils/with-timeout.ts` — function withTimeout: (promise, timeoutMs, dependency) => Promise<T>
- `apps/website/server/utils/work-role-identity.ts` — function findUniqueWorkRoleMatch: (works, matchingWorkIds) => T | undefined
- `apps/website/src/composables/getHydrationCachedData.ts` — function getHydrationCachedData: (key, nuxtApp) => T | undefined
- `apps/website/src/composables/useAdminAuditLogs.ts` — function useAdminAuditLogs, type AdminAuditLog
- `apps/website/src/composables/useAdminLookups.ts`
  - function useAdminLookups: () => void
  - function formatVoiceActorName
  - interface AdminLookupOption
  - type AdminLookups
- `apps/website/src/composables/useAdminReports.ts`
  - function useAdminReports
  - type UserReport
  - const ADMIN_REPORTS_PAGE_SIZE
- `apps/website/src/composables/useCharacterImages.ts`
  - function characterImageKey: (request) => string | null
  - function useCharacterImages: (requests) => void
  - type CharacterImageSource
  - type CharacterImage
  - type CharacterImageRequest
- `apps/website/src/composables/useClientUser.ts` — function useClientUser: () => void
- `apps/website/src/composables/useContribute.ts`
  - function fetchRandomTask
  - function useContribute
  - interface ContributionTask
  - type ContributionCategory
  - type ClaimedCategory
  - type ContributionClaim
- `apps/website/src/composables/useDragScroll.ts` — function useDragScroll: (scrollRef) => void
- `apps/website/src/composables/useDubbingLanguageLabel.ts` — function useDubbingLanguageLabel: () => void
- `apps/website/src/composables/useEditorFormState.ts`
  - function createEditorFormState: (options) => EditorFormState
  - function createUnsavedChangesLeaveGuard: (isDirty) => void
  - function useEditorFormState: (options) => void
  - function createEditorRowKey: () => string
  - interface EditorFormStateOptions
  - interface EditorFormState
  - _...2 more_
- `apps/website/src/composables/useKeyboardInset.ts` — function computeKeyboardInset, function useKeyboardInset
- `apps/website/src/composables/useLocalePathPrefix.ts` — function useLocalePathPrefix: () => (path: string) => string
- `apps/website/src/composables/useLocalePreference.ts` — function useLocalePreference: () => void
- `apps/website/src/composables/useMetadataCreation.ts`
  - function isMetadataValidationError: (error) => boolean
  - function useMetadataCreation: () => void
  - type VoiceActorCreationPayload
- `apps/website/src/composables/useReports.ts` — function useReports
- `apps/website/src/composables/useShowPageData.ts` — function useShowPageData: (showId, locale) => void
- `apps/website/src/composables/useTheme.ts` — function useTheme: () => void
- `apps/website/src/composables/useUrlPagination.ts` — function readUrlPage: (value) => number, function useUrlPagination: (queryKey) => void
- `apps/website/src/composables/useVoiceActorPageData.ts` — function fetchVoiceActorPageData: (id, lang?) => Promise<VoiceActorPageDataPayload | null>
- `apps/website/src/composables/useVoiceActorProfileRecord.ts` — function useVoiceActorProfileRecord: () => void
- `apps/website/src/lib/media-editor-routes.ts` — function getMediaEditorRoute: ({...}, mediaId, projectId, }) => string | null
- `apps/website/src/lib/mediaQueue.ts` — function enqueueMedia: (params) => Promise<void>
- `apps/website/src/utils/access-token-cache.ts` — function createAccessTokenCache: (auth) => void, interface AccessTokenAuthClient
- `apps/website/src/utils/actor-ssr-data.ts` — function prepareActorSsrData: (payload) => void
- `apps/website/src/utils/cast-workspace.ts`
  - function filterCastRows
  - function summarizeCast
  - function getInitials
  - interface CastWorkspaceRow
  - type CastFilter
  - const ORIGINAL_CAST_SEED_LIMIT
  - _...1 more_
- `apps/website/src/utils/detail-dub-projects.ts` — function detailProjectVoiceActorCount: (project) => number, function toCrewCardMembers: (rows) => void
- `apps/website/src/utils/dubbing-project-save.ts`
  - function getEditableDubbingProjectStatus: (value) => DubbingProjectStatus
  - function serializeGameProjectCastRows: (rows) => DubbingProjectCastSaveRow[]
  - function createStableRequestIdFactory: (randomUUID) => void
  - function createDubbingProjectSaveClient: (transport, randomUUID) => void
  - function isDubbingProjectSaveConflict: (error) => boolean
  - function getDubbingProjectSaveErrorMessage: (error) => string
  - _...10 more_
- `apps/website/src/utils/duplicate-work.ts`
  - function duplicateWorkDraftHasChanges: (initial, current) => boolean
  - function canPrefetchDuplicateWorkPage: (requestSucceeded, currentIndex, groupCount, nextCursor) => boolean
  - function rankDuplicateWorks: (works) => DuplicateWorkEntry[]
  - function prefillDuplicateWork: (canonical, works) => void
  - interface DuplicateWorkGroup
  - interface DuplicateWorkPage
  - _...4 more_
- `apps/website/src/utils/error-message.ts` — function readErrorMessage: (err) => string | undefined
- `apps/website/src/utils/locale-preference.ts` — function resolvePreferredLocale: (savedChoice, browserLanguages) => SupportedLocale | null, const LOCALE_PREFERENCE_COOKIE
- `apps/website/src/utils/media-cast.ts`
  - function hasOriginalVersion: (language, cast) => language is string
  - function isOriginalVersionQuery: (value) => boolean
  - function originalVersionCast: (actors) => DisplayCastActor[]
  - function sameMediaId: (left, right) => boolean
  - function matchCastWorks: (actors, works) => CastWorkMatchResult<Actor, Work>
  - interface CastActorReference
  - _...5 more_
- `apps/website/src/utils/posthog-prefetch-manifest.ts` — function deferPosthogPrefetch: (manifest, ClientManifestEntry>) => void, interface ClientManifestEntry
- `apps/website/src/utils/route-param.ts` — function firstRouteParam: (value) => string | undefined
- `apps/website/src/utils/search-routes.ts` — function getSearchResultRoute: (result, "id" | "media_type">) => string, type SearchFilter
- `apps/website/src/utils/season-data.ts`
  - function fetchSeasonPageData: (showId, seasonNumber, locale?) => Promise<SeasonPageDataResponse>
  - function fetchEpisodePageData: (showId, seasonNumber, episodeNumber, locale?, projectId?) => Promise<EpisodePageDataResponse>
  - function fetchEpisodeProjectWorks: (showId, projectId, locale?) => Promise<EpisodePageProjectWorksResponse>
  - interface EpisodePageDubbingProject
  - interface EpisodePageVoiceActor
  - interface EpisodePageDataResponse
  - _...2 more_
- `apps/website/src/utils/share.ts`
  - function buildShareUrl: ({...}, path, dub, keepQuery }) => string
  - function shareUrl: (title, url, {...}, writeText }) => Promise<ShareOutcome>
  - type ShareDub
  - type ShareOutcome
- `apps/website/src/utils/voice-actor-og-image.ts`
  - function isVoiceActorOgImagesEnabled: (value) => boolean
  - function getVoiceActorOgImageMetadata: (enabled, voiceActorId, siteUrl) => VoiceActorOgImageMetadata
  - type VoiceActorOgImageMetadata
- `apps/website/src/utils/voice-actor-profile-save.ts`
  - function voiceActorProfilePayload: (profile) => VoiceActorCreationPayload
  - function changedVoiceActorProfileFields: (previous, current) => Record<string, Json>
  - function displayedSocialLinks: (value) => DisplayedSocialLinks
  - function mergeDisplayedSocialLinks: (original, displayed) => Json | null
  - function profileUnchangedExceptPicture: (before, after) => boolean
  - function refreshVoiceActorProfilePicture: (before, uploadedPath, getProfile) => void
  - _...10 more_
- `e2e/helpers/mock-api.ts`
  - function waitForVueHydration: (page) => Promise<void>
  - function mockSeasonPageResponse: (season) => void
  - function mockEpisodePageResponse: (episode) => void
  - function setupMockApi: (page, options) => void
  - interface MockApiOptions
- `packages/og-image/src/index.ts`
  - function generateTemplate: (options) => void
  - interface GenerateOptions
  - type GeneratorType
- `packages/og-image/src/voice-actor.ts` — function voiceActorGenerator: (params) => void, interface VoiceActorOgParams
- `packages/shared-logic/src/composables/useActorData.ts`
  - function fetchActorData: (id, options) => Promise<ActorDataPayload | null>
  - function useActorData: (initialData?, options) => void
  - type ActorResponse
  - type ActorDataPayload
- `packages/shared-logic/src/composables/useAdvertisementData.ts` — function fetchAdvertisementData: (id, locale?, options?) => Promise<AdvertisementResponse | null>
- `packages/shared-logic/src/composables/useAudiobookData.ts` — function fetchAudiobookData: (id, locale?, options) => Promise<AudiobookResponse | null>
- `packages/shared-logic/src/composables/useDetailCollections.ts`
  - function selectDetailCollectionProject: (projects, projectId) => T | undefined
  - function resolveDetailCollectionProject: (projects, projectId) => T | undefined
  - function formatMediaWorkCastCards: (project) => MediaWorkCastCard[]
  - function formatGameDetailCastCards: (characters, "id"> & {
    id) => void
  - function matchesDetailCollectionSearch: (item, query) => boolean
  - function filterDetailCollectionItems: (items, query) => T[]
  - _...7 more_
- `packages/shared-logic/src/composables/useEpisodeData.ts` — function fetchEpisodeData: (showId, seasonNumber, episodeNumber, locale?) => Promise<EpisodeDataResponse | null>, type EpisodeDataResponse
- `packages/shared-logic/src/composables/useGameData.ts` — function fetchGameData: (id, locale?, projection?) => Promise<GamePageData | null>
- `packages/shared-logic/src/composables/useHomeData.ts`
  - function fetchHomeData: (language) => Promise<HomeDataPayload>
  - function useHomeData: (initialData?) => void
  - type HomeDataPayload
  - type TrendingVoiceActorSummary
  - type TopContributorSummary
- `packages/shared-logic/src/composables/useMovieData.ts` — function fetchMovieData: (id, locale?, options) => Promise<MovieDetailResponse | null>
- `packages/shared-logic/src/composables/usePodcastData.ts` — function fetchPodcastData: (id, locale?, options) => Promise<PodcastResponse | null>
- `packages/shared-logic/src/composables/useSearchData.ts` — function fetchSearchData: (query, signal?, locale?) => Promise<SearchResult[]>, type SearchResult
- `packages/shared-logic/src/composables/useSeasonData.ts` — function fetchSeasonData: (showId, seasonNumber, locale?) => Promise<SeasonDataResponse | null>, type SeasonDataResponse
- `packages/shared-logic/src/composables/useShowData.ts` — function fetchShowData: (id, locale?, options) => Promise<ShowDetailResponse | null>
- `packages/shared-logic/src/composables/useStudioData.ts`
  - function fetchStudioDetails: (studioId, projection?) => Promise<StudioDetailsResponse | null>
  - function fetchStudiosData: () => Promise<Studio[]>
  - function useStudioData: (initialStudios?, initialStudioDetails?) => void
  - type Studio
  - type StudioDubbedProject
  - type StudioVoiceActor
  - _...1 more_
- `packages/shared-logic/src/composables/useToyData.ts` — function fetchToyData: (id, locale?, projection?) => Promise<ToyResponse | null>
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
- `packages/shared-logic/src/dubbing-languages.ts`
  - function isDubbingLanguage: (value) => value is DubbingLanguage
  - function validateDubbingLanguage: (value) => DubbingLanguage
  - function displayDubbingLanguage: (code, locale) => string
  - type DubbingLanguage
  - const DUBBING_LANGUAGE_OPTIONS
  - const DEFAULT_DUBBING_LANGUAGE: DubbingLanguage
- `packages/shared-logic/src/utils/character.ts`
  - function createCharacterMatcher: (roleName) => (characterName: string) => boolean
  - function normalizeCharacterName
  - function findCharacter
- `packages/shared-logic/src/utils/narrow.ts`
  - function isRecord: (value) => value is Record<string, unknown>
  - function readProperty: (value, key) => unknown
  - function readPath: (value, ...keys) => unknown
  - function isJson: (value) => value is Json
- `packages/shared-logic/src/utils/voice-actor-work-groups.ts`
  - function groupVoiceActorWorks: (works) => VoiceActorWorkGroup<T>[]
  - function paginateVoiceActorWorks: (works, view, page, pageSize) => void
  - type VoiceActorWorkLike
  - type VoiceActorWorkGroup
  - type VoiceActorWorksPageItem
- `packages/shared-logic/src/wikipedia-language.ts` — function isWikipediaLanguage: (value) => value is string

---

# Config

## Environment Variables

- `BENCH_CREDITS` (has default) — packages/database/benchmarks/bulk-extracted-credits.mjs
- `BENCH_REPETITIONS` (has default) — packages/database/benchmarks/bulk-extracted-credits.mjs
- `CI` **required** — playwright.config.ts
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
- `E2E_TEST` **required** — apps/website/nuxt.config.ts
- `GEMINI_API_KEY` (has default) — apps/website/server/utils/llm.ts
- `GEMINI_MODELS` **required** — apps/website/server/utils/llm.ts
- `GOOGLE_AI_KEY` **required** — .env.example
- `GROQ_API_KEY` **required** — .env.example
- `GROQ_MODEL` (has default) — apps/website/server/utils/llm.ts
- `IGDB_CLIENT_ID` **required** — .env.example
- `IGDB_CLIENT_SECRET` **required** — .env.example
- `JWT_SECRET` (has default) — .env.example
- `LLM_PROVIDER` (has default) — apps/website/server/utils/llm.ts
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
- `ROUTE_CPU_BASE_OUTPUT` (has default) — apps/website/scripts/route-cpu-ssr.mjs
- `ROUTE_CPU_BASE_WEBSITE_DIR` **required** — apps/website/scripts/route-cpu-ssr.mjs
- `ROUTE_CPU_BENCHMARK` **required** — apps/website/scripts/route-cpu-ssr.mjs
- `ROUTE_CPU_DATASET` **required** — apps/website/scripts/route-cpu-upstream.mjs
- `ROUTE_CPU_HEAD_OUTPUT` (has default) — apps/website/scripts/route-cpu-ssr.mjs
- `ROUTE_CPU_HEAD_WEBSITE_DIR` (has default) — apps/website/scripts/route-cpu-ssr.mjs
- `ROUTE_CPU_HOST_NETWORK_NAMESPACE` **required** — apps/website/scripts/route-cpu-ssr.mjs
- `ROUTE_CPU_METRICS_PATH` **required** — apps/website/scripts/route-cpu-ssr.mjs
- `ROUTE_CPU_METRICS_ROOT` (has default) — apps/website/scripts/route-cpu-ssr.mjs
- `ROUTE_CPU_PROFILE_DIR` **required** — apps/website/scripts/route-cpu-ssr.mjs
- `ROUTE_CPU_PROFILE_ROOT` (has default) — apps/website/scripts/route-cpu-ssr.mjs
- `ROUTE_CPU_ROUTES` **required** — apps/website/scripts/route-cpu-ssr.mjs
- `SUPABASE_PUBLISHABLE_KEY` **required** — .env.example
- `SUPABASE_SECRET_KEY` **required** — .env.example
- `SUPABASE_URL` (has default) — .env.example
- `TMDB_API_KEY` **required** — .env.example
- `TVDB_API_KEY` **required** — .env.example
- `WIKI_LANG` (has default) — scripts/discover-media.ts

## Config Files

- `.env.example`

---

# Middleware

## auth
- generate-social-content.post — `apps/website/server/api/generate-social-content.post.ts`
- auth-handlers.test — `apps/website/server/utils/auth-handlers.test.ts`
- auth-handlers — `apps/website/server/utils/auth-handlers.ts`
- auth-session.test — `apps/website/server/utils/auth-session.test.ts`
- auth-session — `apps/website/server/utils/auth-session.ts`
- auth-usage.test — `apps/website/server/utils/auth-usage.test.ts`
- auth.test — `apps/website/server/utils/auth.test.ts`
- auth — `apps/website/server/utils/auth.ts`
- auth — `apps/website/src/middleware/auth.ts`
- authenticated-fetch — `apps/website/src/plugins/authenticated-fetch.ts`

## custom
- 00-cache — `apps/website/server/middleware/00-cache.ts`
- 00-e2e-mock — `apps/website/server/middleware/00-e2e-mock.ts`
- admin — `apps/website/src/middleware/admin.ts`
- 20260618000000_migrate_to_pgmq — `packages/database/supabase/migrations/20260618000000_migrate_to_pgmq.sql`

## cors
- 01-cors — `apps/website/server/middleware/01-cors.ts`

---

# Dependency Graph

## Most Imported Files (change these carefully)

- `apps/website/server/utils/db/client.ts` — imported by **72** files
- `apps/website/server/utils/auth-handlers.ts` — imported by **37** files
- `apps/website/server/utils/index.ts` — imported by **30** files
- `apps/website/server/utils/cache/index.ts` — imported by **18** files
- `apps/website/server/utils/auth.ts` — imported by **16** files
- `apps/website/server/utils/api/igdb.ts` — imported by **14** files
- `apps/website/server/utils/cache/http.ts` — imported by **12** files
- `packages/shared-logic/src/types/index.ts` — imported by **12** files
- `apps/website/server/utils/urls/supabase.ts` — imported by **11** files
- `apps/website/server/utils/notifications/discord.ts` — imported by **11** files
- `apps/website/server/utils/db/queries.ts` — imported by **10** files
- `apps/website/server/utils/media-request.ts` — imported by **10** files
- `apps/website/server/utils/dubbing-language.ts` — imported by **10** files
- `apps/website/server/utils/narrow.ts` — imported by **10** files
- `apps/website/server/utils/urls/tmdb.ts` — imported by **9** files
- `apps/website/server/utils/services/media.ts` — imported by **9** files
- `e2e/helpers/mock-api.ts` — imported by **8** files
- `apps/website/server/utils/cache/constants.ts` — imported by **7** files
- `apps/website/server/utils/background.ts` — imported by **6** files
- `apps/website/server/utils/with-timeout.ts` — imported by **5** files

## Import Map (who imports what)

- `apps/website/server/utils/db/client.ts` ← `apps/website/server/api/admin/dubbing-project.get.ts`, `apps/website/server/api/admin/dubbing-project.post.ts`, `apps/website/server/api/admin/queue/clear.post.ts`, `apps/website/server/api/admin/queue/item.delete.ts`, `apps/website/server/api/admin/queue/reprocess-legacy-wiki-check-reviews.post.ts` +67 more
- `apps/website/server/utils/auth-handlers.ts` ← `apps/website/server/api/admin/dubbing-project.get.ts`, `apps/website/server/api/admin/dubbing-project.post.ts`, `apps/website/server/api/admin/queue/clear.post.ts`, `apps/website/server/api/admin/queue/item.delete.ts`, `apps/website/server/api/admin/queue/reprocess-legacy-wiki-check-reviews.post.ts` +32 more
- `apps/website/server/utils/index.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/character/[source]/[id].get.ts` +25 more
- `apps/website/server/utils/cache/index.ts` ← `apps/website/server/utils/api/igdb.test.ts`, `apps/website/server/utils/api/igdb.ts`, `apps/website/server/utils/api/openlibrary.test.ts`, `apps/website/server/utils/api/openlibrary.ts`, `apps/website/server/utils/api/podcast.test.ts` +13 more
- `apps/website/server/utils/auth.ts` ← `apps/website/server/api/admin/work-duplicates.get.ts`, `apps/website/server/api/cast-vote.post.ts`, `apps/website/server/api/generate-social-content.post.ts`, `apps/website/server/api/get-work-votes.get.ts`, `apps/website/server/api/manage-subscription.post.ts` +11 more
- `apps/website/server/utils/api/igdb.ts` ← `apps/website/server/api/character/[source]/[id].get.ts`, `apps/website/server/api/game/[id].get.ts`, `apps/website/server/api/internal-media-credits.get.ts`, `apps/website/server/api/internal-media-metadata.get.ts`, `apps/website/server/api/media-catalog.get.ts` +9 more
- `apps/website/server/utils/cache/http.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/admin/work-duplicates.get.ts`, `apps/website/server/api/character-images.get.ts`, `apps/website/server/api/get-media-credits.get.ts`, `apps/website/server/api/og-image/index.get.ts` +7 more
- `packages/shared-logic/src/types/index.ts` ← `packages/shared-logic/src/composables/useAdvertisementData.ts`, `packages/shared-logic/src/composables/useAudiobookData.ts`, `packages/shared-logic/src/composables/useDetailCollections.ts`, `packages/shared-logic/src/composables/useDetailCollections.ts`, `packages/shared-logic/src/composables/useGameData.ts` +7 more
- `apps/website/server/utils/urls/supabase.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/dashboard-stats.get.ts`, `apps/website/server/api/find_duplicate_voice_actors.get.ts`, `apps/website/server/api/list-voice-actors.get.ts`, `apps/website/server/api/recent-voice-actors.get.ts` +6 more
- `apps/website/server/utils/notifications/discord.ts` ← `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/media-queue.post.ts`, `apps/website/server/api/movie/[id].get.ts`, `apps/website/server/api/podcast/[id].get.ts` +6 more

---

# Test Coverage

> **52%** of routes and models are covered by tests
> 162 test files found

## Covered Routes

- GET:/api/about-preference
- GET:/api/admin/dubbing-project
- POST:/api/admin/dubbing-project
- POST:/api/admin/queue/reprocess-legacy-wiki-check-reviews
- POST:/api/cast-vote
- GET:/api/character-images
- POST:/api/count-voice-actor-works
- POST:/api/delete-user-voice-actor-link
- POST:/api/delete-voice-actor-link
- GET:/api/detail-collections
- POST:/api/extract-voice-actor-info
- GET:/api/find_duplicate_voice_actors
- POST:/api/game-characters
- GET:/api/get-random-task
- POST:/api/get-random-task
- GET:/api/get-studio-details
- POST:/api/internal-media-create
- GET:/api/internal-media-credits
- POST:/api/link-user-voice-actor
- POST:/api/link-voice-actor
- POST:/api/manage-subscription
- POST:/api/media-queue
- POST:/api/prepare_game
- POST:/api/process-media-queue
- POST:/api/save-dubbing-project
- POST:/api/save-metadata
- POST:/api/save-studio
- POST:/api/save-toy-metadata
- POST:/api/submit-task
- POST:/api/submit-user-report
- GET:/api/top-contributors
- GET:/api/top-voice-actors
- GET:/api/trending/movies
- POST:/api/update-review-status
- POST:/api/update-voice-actor
- POST:/api/update_voice_actor_link
- POST:/api/upload-profile-picture

## Covered Models

- voice_actors
- source
- work
- user_voice_actor_links
- votes
- dubbing_projects
- studios
- dubbing_project_crew
- jobs
- project_attachments
- voice_actor_subscriptions
- user_reports
- audit_logs
- gamification_task_locks
- dubbing_languages
- dubbing_language_reviews
- legacy_wiki_check_reprocesses
- metadata_write_requests
- voice_actor_write_requests
- regional_assignment_requests
- regional_assignment_request_audits
- toy_metadata
- gamification_task_submission_results
- admin_credit_import_requests
- user_voice_actor_link_requests
- game_characters

---

# CI/CD Pipelines

## GitHub Actions (2 workflows)

| Workflow | Triggers | Jobs | Deploy | Environments |
|---|---|---|---|---|
| codesight | push, workflow_dispatch | 1 | — | — |
| Release and Deployment Pipeline | push, workflow_dispatch | 13 | cloudflare | — |

### Release and Deployment Pipeline

> `.github/workflows/pipeline.yml`

> Concurrency: `${{ github.workflow }}-${{ github.ref }}`

- **detect** on `ubuntu-latest` — 2 steps
  - `actions/checkout@v4`
  - `dorny/paths-filter@v3`
- **database-checks** on `ubuntu-latest` — 11 steps (needs: detect)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
  - `jdx/mise-action@v2`
- **e2e-tests** on `ubuntu-latest` — 8 steps (needs: detect)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
  - `jdx/mise-action@v2`
- **frontend-tests** on `ubuntu-latest` — 5 steps (needs: detect)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
- **typecheck-website** on `ubuntu-latest` — 5 steps (needs: detect)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
- **lint-website** on `ubuntu-latest` — 6 steps (needs: detect)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
- **diff-check** on `ubuntu-latest` — 2 steps (needs: detect)
  - `actions/checkout@v4`
- **i18n-check** on `ubuntu-latest` — 5 steps (needs: detect)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
- **build-website** on `ubuntu-latest` — 7 steps (needs: detect)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
  - `actions/upload-artifact@v4`
- **manual-website-guard** on `ubuntu-latest` — 2 steps (needs: detect)
  - `actions/checkout@v4`
- **release-validation** on `ubuntu-latest` — 1 steps
- **deploy-supabase** on `ubuntu-latest` — 8 steps (needs: detect, release-validation)
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
  - `denoland/setup-deno@v2.0.5`
  - `supabase/setup-cli@v3`
- **deploy-website** on `ubuntu-latest` — 6 steps (needs: detect, release-validation, deploy-supabase) → **cloudflare**
  - `actions/checkout@v4`
  - `pnpm/action-setup@v4`
  - `actions/setup-node@v4`
  - `actions/download-artifact@v4`

### Secrets

- `ADMIN_EMAIL`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `IGDB_CLIENT_ID`
- `IGDB_CLIENT_SECRET`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_TO_EMAIL`
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