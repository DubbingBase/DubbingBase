import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { PostgrestError } from "jsr:@supabase/supabase-js";

interface ProcessImageRequest {
  image: string; // base64 encoded image
  mediaId: number;
}

interface MistralOCRResponse {
  text?: string;
}

export default {
  fetch: withSupabase<Database>({ auth: "publishable:*" }, async (req, ctx) => {
    try {
      const { image, mediaId } = (await req.json()) as ProcessImageRequest;

      if (!image || !mediaId) {
        return Response.json(
          {
            ok: false,
            error:
              "Missing required parameters: image and mediaId are required",
          },
          { status: 400 },
        );
      }

      // Call Mistral OCR API
      const mistralURL = "https://api.mistral.ai/v1/ocr"; // This is a hypothetical endpoint
      const mistralResponse = await fetch(mistralURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("MISTRAL_TOKEN")}`,
        },
        body: JSON.stringify({
          image: image, // base64 encoded image
        }),
      });

      if (!mistralResponse.ok) {
        const errorText = await mistralResponse.text();
        console.error("Mistral OCR API error:", errorText);
        return Response.json(
          {
            ok: false,
            error: `Mistral OCR API error: ${errorText}`,
          },
          { status: mistralResponse.status },
        );
      }

      const ocrResult = (await mistralResponse.json()) as MistralOCRResponse;
      console.log("OCR result:", ocrResult);

      // Save the extracted data to the database
      const { data, error } = await ctx.supabase
        .from("work")
        .insert({
          content_id: mediaId,
          content_type: "image", // Assuming this is an image content type
          suggestions: ocrResult.text || "", // Store the OCR text in suggestions field
        } as any)
        .select();

      if (error) {
        console.error("Database insert error:", error);
        return Response.json(
          {
            ok: false,
            error: `Database insert error: ${error.message}`,
          },
          { status: 500 },
        );
      }

      console.log("Database insert result:", data);

      const result = {
        ok: true,
        ocrResult: ocrResult,
        mediaId: mediaId,
        databaseResult: data,
      };

      return Response.json(result);
    } catch (error: unknown) {
      console.error("Error processing image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return Response.json(
        {
          ok: false,
          error: errorMessage,
        },
        { status: 500 },
      );
    }
  }),
};
