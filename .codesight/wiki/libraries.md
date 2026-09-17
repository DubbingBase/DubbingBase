# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**78 library files** across 5 modules

## Website (41 files)

- `apps/website/server/utils/index.ts` — getCloudflareKv, useCache, useFreshCache, useTmdbClient, useTvdbClient, useIgdbClient, …
- `apps/website/server/utils/cache/wikipedia.ts` — sortLanguagesByPopularity, extractAvailableLanguages, cleanHeadingText, isDubbingSectionHeading, selectDubbingSections, filterValidSectionIndexes, …
- `apps/website/server/utils/services/media-preparation.ts` — checkMediaDubbingSections, checkGameDubbingSections, extractMediaDubbingCredits, extractGameDubbingCredits, prepareMedia, prepareGame, …
- `apps/website/server/utils/cache/constants.ts` — SimpleKeyBuilder, SimpleKeyValidator, API_PREFIXES, CACHE_SCHEMA_VERSION, CONTENT_TYPES, CACHE_KEYS
- `apps/website/server/utils/cache/http.ts` — getPublicCacheControl, setNoCacheHeaders, setNoStoreHeaders, setPublicCacheHeaders, CacheProfile, NO_STORE_CACHE_CONTROL
- `apps/website/server/utils/llm.ts` — areAllLlmQuotasExhausted, getLlmQuotaCache, llmGenerate, llmGenerateObject, llmVision, llmVisionObject
- `apps/website/server/utils/notifications/discord.ts` — normalizeDiscordUrl, buildDiscordEmbed, sendDiscordAdminNotification, DiscordWebhookOptions, QueueName, DiscordNotificationCategory
- `apps/website/server/utils/queue-payload.ts` — validateCheckPayload, validateDiscoveryPayload, validateExtractPayload, ValidQueueBase, ValidExtractPayload, QueueMediaType
- `apps/website/server/utils/db/queries.ts` — getVoiceActorWithWork, getWorkByActor, getDubbingProjects, getWorkVotes, getTopContributors
- `apps/website/server/utils/services/voice-actor.ts` — upsertVoiceActor, upsertActor, upsertStudio, upsertWork, insertVoiceActorAndWork
- `apps/website/src/utils/media-cast.ts` — sameMediaId, matchCastWorks, CastActorReference, CastWorkReference, CastWorkMatchResult
- `apps/website/server/utils/cache/index.ts` — SimpleCache, FreshCache, CacheTTLPreset, CACHE_TTL
- `apps/website/server/utils/pagination.ts` — parsePagination, paginateArray, PaginationOptions, ParsedPagination
- `apps/website/server/utils/urls/tmdb.ts` — buildTmdbImageUrl, cleanCharacterName, processMedia, TMDB_CONFIG
- `apps/website/server/utils/api/igdb.ts` — buildIgdbImageUrl, IgdbClient, IgdbPopularityPrimitive
- `apps/website/server/utils/api/openlibrary.ts` — buildOpenLibraryCoverUrl, OpenLibraryClient
- `apps/website/server/utils/api/podcast.ts` — PodcastClient, ITunesPodcastResult
- `apps/website/server/utils/auth.ts` — requireUser, requireAdmin
- `apps/website/server/utils/normalize.ts` — normalizeString, isExploitableVoiceActorName
- `apps/website/server/utils/notifications/onesignal.ts` — sendOneSignalNotification, OneSignalOptions
- `apps/website/server/utils/urls/supabase.ts` — buildSupabaseImageUrl, processVoiceActor
- `apps/website/src/composables/useContribute.ts` — fetchRandomTask, useContribute
- `apps/website/src/composables/useUrlPagination.ts` — readUrlPage, useUrlPagination
- `apps/website/src/utils/search-routes.ts` — getSearchResultRoute, SearchFilter
- `apps/website/server/api/movie/[id].get.ts` — fetchMovieData
- _…and 16 more files_

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

## Shared-logic (17 files)

- `packages/shared-logic/src/constants.ts` — resolveLocaleLanguage, LocaleConfig, SupportedLocale, NonDefaultLocale, MediaType, MediaRoutePrefix, …
- `packages/shared-logic/src/composables/useStudioData.ts` — fetchStudioDetails, fetchStudiosData, useStudioData, Studio, StudioDetailsResponse
- `packages/shared-logic/src/composables/useVoiceActorData.ts` — fetchVoiceActorData, useVoiceActorData, VoiceActorResponse, EnhancedWorkItem, VoiceActorDataPayload
- `packages/shared-logic/src/composables/useActorData.ts` — fetchActorData, useActorData, ActorResponse, ActorDataPayload
- `packages/shared-logic/src/composables/useDetailCollections.ts` — fetchDetailCollection, DetailCollection, DetailCollectionParams
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

## Og-image (2 files)

- `packages/og-image/src/index.ts` — generateTemplate, GenerateOptions, GeneratorType
- `packages/og-image/src/voice-actor.ts` — voiceActorGenerator, VoiceActorOgParams

## E2e (1 files)

- `e2e/helpers/mock-api.ts` — waitForVueHydration, setupMockApi, MockApiOptions

---
_Back to [overview.md](./overview.md)_