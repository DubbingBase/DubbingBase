# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**122 library files** across 4 modules

## Website (98 files)

- `apps/website/server/utils/db/queries.ts` — getVoiceActorWithWork, getWorkByActor, getActorPageWorkByActor, getDubbingProjects, getDubbingProjectsForMediaEndpoint, getAdvertisementPageDubbingProjects, …
- `apps/website/src/utils/dubbing-project-save.ts` — getEditableDubbingProjectStatus, serializeGameProjectCastRows, createStableRequestIdFactory, createDubbingProjectSaveClient, isDubbingProjectSaveConflict, getDubbingProjectSaveErrorMessage, …
- `apps/website/src/utils/voice-actor-profile-save.ts` — voiceActorProfilePayload, changedVoiceActorProfileFields, displayedSocialLinks, mergeDisplayedSocialLinks, profileUnchangedExceptPicture, refreshVoiceActorProfilePicture, …
- `apps/website/server/utils/cache/wikipedia.ts` — sortLanguagesByPopularity, extractAvailableLanguages, cleanHeadingText, isDubbingSectionHeading, selectDubbingCandidateSections, selectDubbingSections, …
- `apps/website/src/utils/media-cast.ts` — hasOriginalVersion, isOriginalVersionQuery, originalVersionCast, sameMediaId, matchCastWorks, CastActorReference, …
- `apps/website/server/utils/index.ts` — getCloudflareKv, useCache, useTmdbClient, useTvdbClient, useIgdbClient, useOpenLibraryClient, …
- `apps/website/server/utils/services/media-preparation.ts` — checkMediaDubbingSections, checkGameDubbingSections, extractMediaDubbingCredits, extractGameDubbingCredits, prepareMedia, prepareGame, …
- `apps/website/src/utils/duplicate-work.ts` — duplicateWorkDraftHasChanges, canPrefetchDuplicateWorkPage, rankDuplicateWorks, prefillDuplicateWork, DuplicateWorkGroup, DuplicateWorkPage, …
- `apps/website/server/utils/queue-payload.ts` — queueRequester, queueRequesterRpcArgs, validateDiscoveryPayload, validateCheckPayload, validateExtractPayload, ValidQueueBase, …
- `apps/website/server/utils/sitemap.ts` — localizedPath, renderUrlset, renderSitemapIndex, chunkCount, SitemapEntity, SitemapRecord, …
- `apps/website/server/utils/cache/index.ts` — createCacheNamespace, CacheNamespace, SimpleCache, CacheKv, CachePolicy, CacheTTLPreset, …
- `apps/website/src/composables/useEditorFormState.ts` — createEditorFormState, createUnsavedChangesLeaveGuard, useEditorFormState, createEditorRowKey, EditorFormStateOptions, EditorFormState, …
- `apps/website/src/utils/season-data.ts` — fetchSeasonPageData, fetchEpisodePageData, fetchEpisodeProjectWorks, EpisodePageDubbingProject, EpisodePageVoiceActor, EpisodePageDataResponse, …
- `apps/website/server/utils/contribution/task-submission-validation.ts` — isTaskClaimId, authorizeTaskContribution, validateTaskContribution, TaskCategory, TaskUpload, TaskContributionInput, …
- `apps/website/src/utils/cast-workspace.ts` — filterCastRows, summarizeCast, getInitials, CastWorkspaceRow, CastFilter, ORIGINAL_CAST_SEED_LIMIT, …
- `apps/website/server/utils/cache/http.ts` — getPublicCacheControl, getCloudflareCacheControl, setNoCacheHeaders, setPublicCacheHeaders, CacheProfile, NO_STORE_CACHE_CONTROL
- `apps/website/server/utils/llm.ts` — areAllLlmQuotasExhausted, getLlmQuotaCache, llmGenerate, llmGenerateObject, llmVision, llmVisionObject
- `apps/website/server/utils/notifications/discord.ts` — normalizeDiscordUrl, buildDiscordEmbed, sendDiscordAdminNotification, DiscordWebhookOptions, QueueName, DiscordNotificationCategory
- `apps/website/src/composables/useContribute.ts` — fetchRandomTask, useContribute, ContributionTask, ContributionCategory, ClaimedCategory, ContributionClaim
- `apps/website/server/utils/cache/constants.ts` — hashCacheValue, buildCacheKey, SimpleKeyValidator, CacheKeyInput, CACHE_SCHEMA_VERSION
- `apps/website/server/utils/cache/response-policy.ts` — resolveCacheDecision, applyDefaultCachePolicy, applyCachePolicy, CacheDecisionInput, CacheDecision
- `apps/website/server/utils/prepare-payload.ts` — validatePrepareGamePayload, prepareGameFromPayload, validatePrepareMediaPayload, PrepareGameInput, PrepareMediaInput
- `apps/website/server/utils/retryable-request.ts` — isRetryableMediaRequestError, isRetryableMediaRequestStatus, createMediaResponseError, fetchMediaRequest, RetryableMediaRequestError
- `apps/website/server/utils/services/media.ts` — MediaService, VOICE_ACTOR_PAGE_TMDB_MEDIA_NAMESPACE, VOICE_ACTOR_PAGE_TMDB_BACKDROP_NAMESPACE, WIKIPEDIA_ACTOR_URL_NAMESPACE, MEDIA_TVDB_CHARACTERS_NAMESPACE
- `apps/website/server/utils/services/wiki-extraction-batching.ts` — buildWikipediaExtractionBatches, deduplicateExtractedCredits, WikipediaExtractionSection, WikipediaExtractionBatch, MAX_WIKIPEDIA_EXTRACTION_PROMPT_CHARS
- _…and 73 more files_

## Shared-logic (21 files)

- `packages/shared-logic/src/constants.ts` — resolveLocaleLanguage, LocaleConfig, SupportedLocale, NonDefaultLocale, MediaType, MediaRoutePrefix, …
- `packages/shared-logic/src/composables/useDetailCollections.ts` — selectDetailCollectionProject, resolveDetailCollectionProject, formatMediaWorkCastCards, formatGameDetailCastCards, matchesDetailCollectionSearch, filterDetailCollectionItems, …
- `packages/shared-logic/src/composables/useStudioData.ts` — fetchStudioDetails, fetchStudiosData, useStudioData, Studio, StudioDubbedProject, StudioVoiceActor, …
- `packages/shared-logic/src/dubbing-languages.ts` — isDubbingLanguage, validateDubbingLanguage, displayDubbingLanguage, DubbingLanguage, DUBBING_LANGUAGE_OPTIONS, DEFAULT_DUBBING_LANGUAGE
- `packages/shared-logic/src/composables/useHomeData.ts` — fetchHomeData, useHomeData, HomeDataPayload, TrendingVoiceActorSummary, TopContributorSummary
- `packages/shared-logic/src/composables/useVoiceActorData.ts` — fetchVoiceActorData, useVoiceActorData, VoiceActorResponse, EnhancedWorkItem, VoiceActorDataPayload
- `packages/shared-logic/src/utils/voice-actor-work-groups.ts` — groupVoiceActorWorks, paginateVoiceActorWorks, VoiceActorWorkLike, VoiceActorWorkGroup, VoiceActorWorksPageItem
- `packages/shared-logic/src/composables/useActorData.ts` — fetchActorData, useActorData, ActorResponse, ActorDataPayload
- `packages/shared-logic/src/utils/narrow.ts` — isRecord, readProperty, readPath, isJson
- `packages/shared-logic/src/utils/character.ts` — createCharacterMatcher, normalizeCharacterName, findCharacter
- `packages/shared-logic/src/composables/useEpisodeData.ts` — fetchEpisodeData, EpisodeDataResponse
- `packages/shared-logic/src/composables/useSearchData.ts` — fetchSearchData, SearchResult
- `packages/shared-logic/src/composables/useSeasonData.ts` — fetchSeasonData, SeasonDataResponse
- `packages/shared-logic/src/composables/useAdvertisementData.ts` — fetchAdvertisementData
- `packages/shared-logic/src/composables/useAudiobookData.ts` — fetchAudiobookData
- `packages/shared-logic/src/composables/useGameData.ts` — fetchGameData
- `packages/shared-logic/src/composables/useMovieData.ts` — fetchMovieData
- `packages/shared-logic/src/composables/usePodcastData.ts` — fetchPodcastData
- `packages/shared-logic/src/composables/useShowData.ts` — fetchShowData
- `packages/shared-logic/src/composables/useToyData.ts` — fetchToyData
- `packages/shared-logic/src/wikipedia-language.ts` — isWikipediaLanguage

## Og-image (2 files)

- `packages/og-image/src/index.ts` — generateTemplate, GenerateOptions, GeneratorType
- `packages/og-image/src/voice-actor.ts` — voiceActorGenerator, VoiceActorOgParams

## E2e (1 files)

- `e2e/helpers/mock-api.ts` — waitForVueHydration, mockSeasonPageResponse, mockEpisodePageResponse, setupMockApi, MockApiOptions

---
_Back to [overview.md](./overview.md)_