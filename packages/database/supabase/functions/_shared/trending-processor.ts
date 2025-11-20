import { corsHeaders } from "./http-utils.ts"

// Types and interfaces for the trending processor
export interface MediaItem {
  id: number
  title?: string
  name?: string
  popularity: number
  type: 'movie' | 'tv'
}

export interface ProcessingResult {
  status: 'fulfilled' | 'rejected'
  value?: {
    title: string
    type: 'movie' | 'tv'
  }
  reason?: {
    title: string
    type: 'movie' | 'tv'
    error: string
  }
}

export interface TrendingProcessorConfig {
  mediaType: 'movie' | 'tv' | 'both'
  tmdbApiPath: string
  prepareFunctionUrl: string | { movie: string; tv: string }
  delayMs?: number
  maxItems?: number
  ntfyTopic?: string
  notificationTitle?: string
}

export interface TrendingProcessorResult {
  ok: boolean
  message: string
  summary: string
  successfulCount: number
  failedCount: number
  results: ProcessingResult[]
}

/**
 * Validates required environment variables
 */
export function validateEnvironment(): { isValid: boolean; missingVars: string[] } {
  const requiredVars = [
    'TMDB_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]

  const missingVars = requiredVars.filter(varName => !Deno.env.get(varName))

  return {
    isValid: missingVars.length === 0,
    missingVars
  }
}

/**
 * Fetches trending media items from TMDB API
 */
export async function fetchTrendingMedia(
  mediaType: 'movie' | 'tv' | 'both',
  tmdbApiPath: string
): Promise<MediaItem[]> {
  const tmdbApiKey = Deno.env.get('TMDB_API_KEY')

  if (!tmdbApiKey) {
    throw new Error('TMDB_API_KEY environment variable is not set')
  }

  if (mediaType === 'both') {
    // Fetch both movies and TV shows
    const [moviesResponse, showsResponse] = await Promise.all([
      fetch('https://api.themoviedb.org/3/trending/movie/day?language=fr-FR', {
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${tmdbApiKey}`,
          'Accept': 'application/json',
        },
      }),
      fetch('https://api.themoviedb.org/3/trending/tv/day?language=fr-FR', {
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${tmdbApiKey}`,
          'Accept': 'application/json',
        },
      })
    ])

    if (!moviesResponse.ok) {
      throw new Error(`Movies API request failed: ${moviesResponse.status} ${moviesResponse.statusText}`)
    }
    if (!showsResponse.ok) {
      throw new Error(`TV Shows API request failed: ${showsResponse.status} ${showsResponse.statusText}`)
    }

    const [moviesData, showsData] = await Promise.all([
      moviesResponse.json(),
      showsResponse.json()
    ])

    const movies = (moviesData.results || []).map((item: any) => ({
      ...item,
      type: 'movie' as const
    }))

    const shows = (showsData.results || []).map((item: any) => ({
      ...item,
      type: 'tv' as const
    }))

    return [...movies, ...shows]
  } else {
    // Fetch single media type
    const response = await fetch(`${tmdbApiPath}?language=fr-FR`, {
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${tmdbApiKey}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`TMDB API request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    return (data.results || []).map((item: any) => ({
      ...item,
      type: mediaType
    }))
  }
}

/**
 * Processes media items sequentially with error handling and delays
 */
export async function processMediaItems(
  mediaItems: MediaItem[],
  config: TrendingProcessorConfig
): Promise<ProcessingResult[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const results: ProcessingResult[] = []
  const delayMs = config.delayMs ?? 5000
  const maxItems = config.maxItems ?? mediaItems.length

  // Limit items if specified
  const itemsToProcess = mediaItems.slice(0, maxItems)

  console.log(`Starting sequential processing of ${itemsToProcess.length} ${config.mediaType} items.`)

  for (const media of itemsToProcess) {
    const tmdbId = media.id
    const title = media.title ?? media.name

    const result = await (async (): Promise<ProcessingResult> => {
      // Determine the correct function URL based on media type
      const functionUrl = typeof config.prepareFunctionUrl === 'string'
        ? config.prepareFunctionUrl
        : config.prepareFunctionUrl[media.type]

      console.log(`Invoking ${functionUrl} for ${media.type} ${tmdbId} (${title})`)

      // Determine the correct parameter name based on the function being called
      const isShowFunction = functionUrl.includes('/show')
      const requestBody = isShowFunction
        ? { id: tmdbId }  // show function expects 'id'
        : { tmdbId, type: config.mediaType }  // prepare_movie function expects 'tmdbId' and 'type'

      console.log(`DEBUG: Sending parameters to ${isShowFunction ? 'show' : 'prepare_movie'} function:`, requestBody)

      try {
        const invokeResponse = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(requestBody),
        })

        if (!invokeResponse.ok) {
          const errorBody = await invokeResponse.text()
          throw new Error(`Status ${invokeResponse.status}: ${errorBody}`)
        }

        const result = await invokeResponse.json()
        if (result.ok === false) {
          throw new Error(result.error || `${config.prepareFunctionUrl} returned an error`)
        }

        return {
          status: 'fulfilled',
          value: { title: title || 'Unknown', type: media.type }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to process ${config.mediaType} ${tmdbId} (${title}):`, errorMessage)
        console.error(`DEBUG: Request body that was sent:`, requestBody)
        return {
          status: 'rejected',
          reason: {
            title: title || 'Unknown',
            type: media.type,
            error: errorMessage
          }
        }
      }
    })()

    results.push(result)

    // Add delay to prevent rate limiting
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return results
}

/**
 * Generates processing summaries separating successful vs failed items
 */
export function generateSummary(results: ProcessingResult[]): {
  summary: string
  successfulCount: number
  failedCount: number
  successfulMovies: ProcessingResult[]
  successfulShows: ProcessingResult[]
  failedJobs: ProcessingResult[]
} {
  const successfulMovies = results.filter(r =>
    r.status === 'fulfilled' && r.value?.type === 'movie'
  )
  const successfulShows = results.filter(r =>
    r.status === 'fulfilled' && r.value?.type === 'tv'
  )
  const failedJobs = results.filter(r => r.status === 'rejected')

  const successfulCount = successfulMovies.length + successfulShows.length
  const failedCount = failedJobs.length

  let summary = `DubbingBase Trending Media Report:\n`
  summary += `- ✅ Processed ${successfulMovies.length} movies and ${successfulShows.length} shows successfully.\n`

  // List successful items
  const successfulItems = [...successfulMovies, ...successfulShows]
  for (const item of successfulItems) {
    summary += `  - ${item.value?.title ?? 'Unknown'}\n`
  }

  // List failed items
  if (failedJobs.length > 0) {
    summary += `- ❌ Encountered ${failedJobs.length} errors.\n`
    failedJobs.forEach(job => {
      const reason = job.reason
      if (reason) {
        summary += `  - Failed: ${reason.type} "${reason.title}" (Reason: ${reason.error})\n`
      }
    })
  }

  return {
    summary,
    successfulCount,
    failedCount,
    successfulMovies,
    successfulShows,
    failedJobs
  }
}

/**
 * Sends ntfy notifications with error handling
 */
export async function sendNotification(
  message: string,
  topic: string,
  title: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      body: message,
      headers: {
        'Title': title,
      }
    })
    console.log('Sent ntfy notification.')
    return { success: true }
  } catch (error) {
    console.error('Failed to send ntfy notification:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Main orchestrating function that handles the entire trending media processing flow
 */
export async function processTrendingMedia(
  config: TrendingProcessorConfig
): Promise<TrendingProcessorResult> {
  try {
    // Validate environment
    const envValidation = validateEnvironment()
    if (!envValidation.isValid) {
      throw new Error(`Missing environment variables: ${envValidation.missingVars.join(', ')}`)
    }

    // Fetch trending media
    const mediaItems = await fetchTrendingMedia(config.mediaType, config.tmdbApiPath)

    if (mediaItems.length === 0) {
      const message = `No trending ${config.mediaType} items found`
      return {
        ok: true,
        message,
        summary: message,
        successfulCount: 0,
        failedCount: 0,
        results: []
      }
    }

    // Sort by popularity and limit if needed
    const sortedItems = mediaItems.sort((a, b) => b.popularity - a.popularity)
    const maxItems = config.maxItems ?? sortedItems.length
    const itemsToProcess = sortedItems.slice(0, maxItems)

    // Process items sequentially
    const results = await processMediaItems(itemsToProcess, config)

    // Generate summary
    const summaryData = generateSummary(results)

    // Send notification if configured
    if (config.ntfyTopic && config.notificationTitle) {
      await sendNotification(
        summaryData.summary,
        config.ntfyTopic,
        config.notificationTitle
      )
    }

    return {
      ok: true,
      message: "Trending media processing completed.",
      summary: summaryData.summary,
      successfulCount: summaryData.successfulCount,
      failedCount: summaryData.failedCount,
      results
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Trending media processing failed:', errorMessage)

    return {
      ok: false,
      message: `Trending media processing failed: ${errorMessage}`,
      summary: `Error: ${errorMessage}`,
      successfulCount: 0,
      failedCount: 0,
      results: []
    }
  }
}