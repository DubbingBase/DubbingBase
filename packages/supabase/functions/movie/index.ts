// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { Database } from '../_shared/database.types.ts';
import { TMDBClient } from "../_shared/tmdb.ts"
import { TVDBClient } from "../_shared/tvdb.ts"
import { DatabaseClient, supabaseUser } from "../_shared/database.ts"
import { createResponse, createErrorResponse, handleOptions } from "../_shared/http-utils.ts"
import { processMedia } from "../_shared/tmdb-urls.ts";
import { processVoiceActor } from "../_shared/supabase-urls.ts";
import { SimpleCache } from "../_shared/cache-utils.ts"
import { RedisClient } from "../_shared/redis.ts"
import { cacheUtils } from "../_shared/index.ts"

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const { id } = await req.json()

    if (!id) {
      return createErrorResponse('Missing id parameter', 400)
    }

    const movieId = parseInt(id, 10)
    if (isNaN(movieId)) {
      return createErrorResponse('Invalid id parameter', 400)
    }

    // Use shared TMDBClient for API calls
    const tmdbClient = new TMDBClient(cacheUtils)

    // Initialize cache with Redis client
    const cache = new SimpleCache(new RedisClient())

    // Try cache first for movie data, fallback to API
    let movie: any = await cache.get(`tmdb:movie:${movieId}`)
    if (!movie) {
      console.log(`Cache miss for TMDB movie ${movieId}, fetching from API`)
      movie = await tmdbClient.get(`movie/${movieId}`, {
        append_to_response: 'credits,external_ids'
      })
      // Cache the result for future requests
      cache.set(`tmdb:movie:${movieId}`, movie, 'MEDIUM').catch(err =>
        console.error('Failed to cache TMDB movie data:', err)
      )
    } else {
      console.log(`Cache hit for TMDB movie ${movieId}`)
    }
    const movieWithImageUrls = processMedia(movie)

    // Use TVDBClient to get character profile pictures
    const tvdbClient = new TVDBClient(cacheUtils)
    let characterProfilePictures: any[] = []

    try {
      // Try to find TheTVDB series ID from TMDB external_ids first
      let tvdbSeriesId: number | null = null

      if (movie.external_ids?.tvdb_id) {
        tvdbSeriesId = movie.external_ids.tvdb_id
        console.log(`Found TVDB series ID from TMDB external_ids: ${tvdbSeriesId}`)
      } else {
        // Fallback to search if no direct external_id
        console.log('No direct TVDB external_id found, searching...')
        const searchQuery = movie.title || movie.original_title
        if (searchQuery) {
          const searchResults = await tvdbClient.searchSeries(searchQuery)
          if (searchResults.data && searchResults.data.length > 0) {
            console.log('searchResults.data', searchResults.data)
            // Find the best match (could be improved with more sophisticated matching)
            const bestMatch = searchResults.data.find((series: any) =>
              series.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              searchQuery.toLowerCase().includes(series.name?.toLowerCase())
            ) || searchResults.data[0]
            tvdbSeriesId = bestMatch?.tvdb_id
            console.log(`Found TVDB series ID from search: ${tvdbSeriesId}`)
          }
        }
      }

      // Get character profile pictures if we found a TVDB series ID
      if (tvdbSeriesId) {
        // Try cache first for character data, fallback to API
        const cacheKey = `tvdb:movie:characters:${tvdbSeriesId}`
        const cachedCharacters = await cache.get(cacheKey)

        if (cachedCharacters) {
          console.log(`Cache hit for TVDB movie characters ${tvdbSeriesId}`)
          characterProfilePictures = cachedCharacters as any[]
        } else {
          console.log(`Cache miss for TVDB movie characters ${tvdbSeriesId}, fetching from API`)
          const charactersResponse = await tvdbClient.getMovieById(tvdbSeriesId, {
            meta: 'translations',
            short: false,
          })
          const characters = charactersResponse.data.characters
          if (characters && characters.length > 0) {
            console.log('characters', characters)
            characterProfilePictures = characters
              .filter((character: any) => character.image)
              .map((character: any) => ({
                id: character.id,
                name: character.name,
                image: character.image,
                movieId: movieId
              }))
            console.log(`Found ${characterProfilePictures.length} character profile pictures`)

            // Cache the character data with shorter TTL since character data can be more dynamic
            cache.set(cacheKey, characterProfilePictures, 'SHORT').catch(err =>
              console.error('Failed to cache TVDB movie character data:', err)
            )
          }
        }
      } else {
        console.log('No TVDB series ID found, skipping character profile pictures')
      }
    } catch (tvdbError) {
      console.error('Error fetching character profile pictures from TVDB:', tvdbError)
      // Continue without character profile pictures - don't fail the entire request
    }

    // Use shared DatabaseClient for database queries
    const dbClient = new DatabaseClient()
    const voiceActors = await dbClient.getWorkWithVoiceActors(movieId)

    // Get work IDs for vote fetching
    const workIds = voiceActors.map(va => va.id)

    // Get vote data if there are work entries and user is authenticated
    let voteData: Record<number, { up_count: number; down_count: number; user_vote: string | null }> = {}
    if (workIds.length > 0) {
      try {
        const authHeader = req.headers.get('Authorization')
        if (authHeader) {
          const supabase = supabaseUser(authHeader)
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            voteData = await dbClient.getWorkVotes(workIds, user.id)
          }
        } else {
          voteData = await dbClient.getWorkVotes(workIds)
        }
      } catch (voteError) {
        console.error('Error fetching vote data:', voteError)
        // Continue without vote data - don't fail the entire request
      }
    }

    const voiceActorsWithImages = voiceActors.map(va => ({
      ...va,
      voiceActorDetails: processVoiceActor(va.voiceActorDetails),
      up_votes: voteData[va.id]?.up_count || 0,
      down_votes: voteData[va.id]?.down_count || 0,
      user_vote: voteData[va.id]?.user_vote || null
    }))

    const result = {
      movie: movieWithImageUrls,
      voiceActors: voiceActorsWithImages,
      characterProfilePictures: characterProfilePictures,
    }

    return createResponse(result)
  } catch (error) {
    console.error('Error in movie function:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'An unknown error occurred'
    )
  }
})
