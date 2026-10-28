# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**110 library files** across 5 modules

## Website (70 files)

- `apps/website/src/utils/dubbing-project-save.ts` — getEditableDubbingProjectStatus, serializeGameProjectCastRows, createStableRequestIdFactory, createDubbingProjectSaveClient, isDubbingProjectSaveConflict, getDubbingProjectSaveErrorMessage, …
- `apps/website/server/utils/cache/wikipedia.ts` — sortLanguagesByPopularity, extractAvailableLanguages, cleanHeadingText, isDubbingSectionHeading, selectDubbingCandidateSections, selectDubbingSections, …
- `apps/website/server/utils/index.ts` — getCloudflareKv, useCache, useTmdbClient, useTvdbClient, useIgdbClient, useOpenLibraryClient, …
- `apps/website/server/utils/services/media-preparation.ts` — checkMediaDubbingSections, checkGameDubbingSections, extractMediaDubbingCredits, extractGameDubbingCredits, prepareMedia, prepareGame, …
- `apps/website/src/utils/duplicate-work.ts` — duplicateWorkDraftHasChanges, canPrefetchDuplicateWorkPage, rankDuplicateWorks, prefillDuplicateWork, DuplicateWorkEntry, DuplicateWorkGroup, …
- `apps/website/server/utils/queue-payload.ts` — queueRequester, queueRequesterRpcArgs, validateDiscoveryPayload, validateCheckPayload, validateExtractPayload, ValidQueueBase, …
- `apps/website/src/utils/actor-grid-html.ts` — escapeActorHtml, renderActorImageHtml, renderActorVoiceActorCardHtml, renderActorFilmographyCardHtml, ActorImageAttributes, ActorFilmographyCopy, …
- `apps/website/server/utils/cache/index.ts` — createCacheNamespace, CacheNamespace, SimpleCache, CacheKv, CachePolicy, CacheTTLPreset, …
- `apps/website/server/utils/db/queries.ts` — getVoiceActorWithWork, getWorkByActor, getActorPageWorkByActor, getDubbingProjects, getDubbingProjectsForMediaEndpoint, getMediaPageDubbingProjects, …
- `apps/website/server/utils/contribution/task-submission-validation.ts` — isTaskClaimId, authorizeTaskContribution, validateTaskContribution, TaskCategory, TaskUpload, TaskContributionInput, …
- `apps/website/src/utils/media-cast.ts` — sameMediaId, matchCastWorks, CastActorReference, CharacterProfilePicture, CastWorkReference, DisplayCastActor, …
- `apps/website/server/utils/cache/http.ts` — getPublicCacheControl, getCloudflareCacheControl, setNoCacheHeaders, setPublicCacheHeaders, CacheProfile, NO_STORE_CACHE_CONTROL
- `apps/website/server/utils/llm.ts` — areAllLlmQuotasExhausted, getLlmQuotaCache, llmGenerate, llmGenerateObject, llmVision, llmVisionObject
- `apps/website/server/utils/notifications/discord.ts` — normalizeDiscordUrl, buildDiscordEmbed, sendDiscordAdminNotification, DiscordWebhookOptions, QueueName, DiscordNotificationCategory
- `apps/website/src/composables/useContribute.ts` — fetchRandomTask, useContribute, ContributionTask, ContributionCategory, ClaimedCategory, ContributionClaim
- `apps/website/server/utils/cache/constants.ts` — hashCacheValue, buildCacheKey, SimpleKeyValidator, CacheKeyInput, CACHE_SCHEMA_VERSION
- `apps/website/server/utils/prepare-payload.ts` — validatePrepareGamePayload, prepareGameFromPayload, validatePrepareMediaPayload, PrepareGameInput, PrepareMediaInput
- `apps/website/server/utils/retryable-request.ts` — isRetryableMediaRequestError, isRetryableMediaRequestStatus, createMediaResponseError, fetchMediaRequest, RetryableMediaRequestError
- `apps/website/server/utils/services/wiki-extraction-batching.ts` — buildWikipediaExtractionBatches, deduplicateExtractedCredits, WikipediaExtractionSection, WikipediaExtractionBatch, MAX_WIKIPEDIA_EXTRACTION_PROMPT_CHARS
- `apps/website/server/utils/api/igdb.ts` — buildIgdbImageUrl, IgdbClient, IgdbTrendingGamesResult, IgdbPopularityPrimitive
- `apps/website/server/utils/pagination.ts` — parsePagination, paginateArray, PaginationOptions, ParsedPagination
- `apps/website/server/utils/services/voice-actor.ts` — applyExtractedCredits, upsertStudio, ExtractedCredit, AppliedExtractedCredits
- `apps/website/server/utils/urls/tmdb.ts` — buildTmdbImageUrl, cleanCharacterName, processMedia, TMDB_CONFIG
- `apps/website/server/utils/wiki-check-disposition.ts` — wikiCheckDisposition, WikiCheckArchiveReason, WikiCheckSkippedResult, WikiCheckDisposition
- `apps/website/src/utils/show-character-pictures.ts` — indexCharacterPictures, findCharacterImage, CharacterProfilePicture, CharacterPictureIndex
- _…and 45 more files_

## Shared-logic (20 files)

- `packages/shared-logic/src/constants.ts` — resolveLocaleLanguage, LocaleConfig, SupportedLocale, NonDefaultLocale, MediaType, MediaRoutePrefix, …
- `packages/shared-logic/src/composables/useDetailCollections.ts` — selectDetailCollectionProject, resolveDetailCollectionProject, formatMediaWorkCastCards, formatGameDetailCastCards, matchesDetailCollectionSearch, filterDetailCollectionItems, …
- `packages/shared-logic/src/dubbing-languages.ts` — isDubbingLanguage, validateDubbingLanguage, displayDubbingLanguage, DubbingLanguage, DUBBING_LANGUAGE_OPTIONS, DEFAULT_DUBBING_LANGUAGE
- `packages/shared-logic/src/composables/useStudioData.ts` — fetchStudioDetails, fetchStudiosData, useStudioData, Studio, StudioDetailsResponse
- `packages/shared-logic/src/composables/useVoiceActorData.ts` — fetchVoiceActorData, useVoiceActorData, VoiceActorResponse, EnhancedWorkItem, VoiceActorDataPayload
- `packages/shared-logic/src/utils/voice-actor-work-groups.ts` — groupVoiceActorWorks, paginateVoiceActorWorks, VoiceActorWorkLike, VoiceActorWorkGroup, VoiceActorWorksPageItem
- `packages/shared-logic/src/composables/useActorData.ts` — fetchActorData, useActorData, ActorResponse, ActorDataPayload
- `packages/shared-logic/src/composables/useHomeData.ts` — fetchHomeData, useHomeData, HomeDataPayload
- `packages/shared-logic/src/composables/useSearchData.ts` — fetchSearchData, SearchResult
- `packages/shared-logic/src/utils/character.ts` — normalizeCharacterName, findCharacter
- `packages/shared-logic/src/composables/useAdvertisementData.ts` — fetchAdvertisementData
- `packages/shared-logic/src/composables/useAudiobookData.ts` — fetchAudiobookData
- `packages/shared-logic/src/composables/useEpisodeData.ts` — fetchEpisodeData
- `packages/shared-logic/src/composables/useGameData.ts` — fetchGameData
- `packages/shared-logic/src/composables/useMovieData.ts` — fetchMovieData
- `packages/shared-logic/src/composables/usePodcastData.ts` — fetchPodcastData
- `packages/shared-logic/src/composables/useSeasonData.ts` — fetchSeasonData
- `packages/shared-logic/src/composables/useShowData.ts` — fetchShowData
- `packages/shared-logic/src/composables/useToyData.ts` — fetchToyData
- `packages/shared-logic/src/wikipedia-language.ts` — isWikipediaLanguage

## Mobile (17 files)

- `apps/mobile/src/composables/useVoiceActorManagement.ts` — useVoiceActorManagement, VoiceActor, WorkAndVoiceActor
- `apps/mobile/src/utils/convert.ts` — cleanCharacterName, voiceActorToPersonData, actorToPersonData
- `apps/mobile/src/utils/deepLinks.ts` — parseDeepLink, handleDeepLink, useDeepLinkHandler
- `apps/mobile/src/composables/useToast.ts` — useToast, toastController
- `apps/mobile/src/composables/useVoiceActorSubscription.ts` — useVoiceActorSubscription, fetchAllSubscriptions
- `apps/mobile/src/stores/index.ts` — setupStores, pinia
- `apps/mobile/src/api/mediaQueue.ts` — enqueueMedia
- `apps/mobile/src/api/nitro.ts` — nitroRequest
- `apps/mobile/src/composables/useDeferredCharacters.ts` — useDeferredCharacters
- `apps/mobile/src/composables/useFF.ts` — useFeatureFlags
- `apps/mobile/src/composables/useLanguagePreference.ts` — useLanguagePreference
- `apps/mobile/src/composables/useOneSignal.ts` — useOneSignal
- `apps/mobile/src/composables/usePermissions.ts` — usePermissions
- `apps/mobile/src/composables/usePostHog.ts` — usePostHog
- `apps/mobile/src/composables/useTheme.ts` — useTheme
- `apps/mobile/src/utils/image.ts` — getAvatarFallbackUrl
- `apps/mobile/src/utils/language.ts` — getLanguageDisplayName

## Og-image (2 files)

- `packages/og-image/src/index.ts` — generateTemplate, GenerateOptions, GeneratorType
- `packages/og-image/src/voice-actor.ts` — voiceActorGenerator, VoiceActorOgParams

## E2e (1 files)

- `e2e/helpers/mock-api.ts` — waitForVueHydration, setupMockApi, MockApiOptions

---
_Back to [overview.md](./overview.md)_