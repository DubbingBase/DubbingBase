// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createResponse, createErrorResponse, handleOptions } from "../_shared/http-utils.ts"
import { mediaService } from "../_shared/index.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const { id } = await req.json()

    if (!id) {
      return createErrorResponse('Missing id parameter', 400)
    }

    console.log('Fetching voice actor with id:', id)

    const result = await mediaService.getVoiceActorWithWorkAndMedia(id)

    return createResponse(result)
  } catch (error) {
    console.error('Error fetching voice actor:', error)
    return createErrorResponse('Failed to fetch voice actor data')
  }
})
