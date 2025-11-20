// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"
import { Database } from "../_shared/database.types.ts"
import { PostgrestError } from "jsr:@supabase/supabase-js"

interface ProcessImageRequest {
  image: string // base64 encoded image
  mediaId: number
}

interface MistralOCRResponse {
  // This would be defined based on the actual Mistral OCR API response
  text?: string
  // Add other fields as needed based on the OCR API response
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image, mediaId } = await req.json() as ProcessImageRequest

    if (!image || !mediaId) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Missing required parameters: image and mediaId are required'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      })
    }

    // Call Mistral OCR API
    const mistralURL = 'https://api.mistral.ai/v1/ocr' // This is a hypothetical endpoint
    const mistralResponse = await fetch(mistralURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('MISTRAL_TOKEN')}`
      },
      body: JSON.stringify({
        image: image, // base64 encoded image
        // Add any other required parameters for the OCR API
      })
    })

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text()
      console.error('Mistral OCR API error:', errorText)
      return new Response(JSON.stringify({
        ok: false,
        error: `Mistral OCR API error: ${errorText}`
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: mistralResponse.status
      })
    }

    const ocrResult = await mistralResponse.json() as MistralOCRResponse
    console.log('OCR result:', ocrResult)

    // Save the extracted data to the database
    const { data, error } = await supabase
      .from('work')
      .insert({
        content_id: mediaId,
        content_type: 'image', // Assuming this is an image content type
        suggestions: ocrResult.text || '', // Store the OCR text in suggestions field
        // We don't have voice_actor_id or actor_id, so they will be null
      })
      .select()

    if (error) {
      console.error('Database insert error:', error)
      return new Response(JSON.stringify({
        ok: false,
        error: `Database insert error: ${error.message}`
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 500
      })
    }

    console.log('Database insert result:', data)

    const result = {
      ok: true,
      ocrResult: ocrResult,
      mediaId: mediaId,
      databaseResult: data
    }

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    })

  } catch (error: unknown) {
    console.error('Error processing image:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({
      ok: false,
      error: errorMessage
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    })
  }
})
