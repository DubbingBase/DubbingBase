import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const contentType = req.headers.get("content-type") || "";
      let imageBase64 = "";
      let actorsStr: string | null = null;

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("image") as File | null;
        actorsStr = formData.get("actors") as string | null;
        
        if (!file) {
          return Response.json(
            { ok: false, error: "Missing required parameter: image" },
            { status: 400 },
          );
        }
        
        const arrayBuffer = await file.arrayBuffer();
        imageBase64 = `data:${file.type || "image/jpeg"};base64,${encodeBase64(arrayBuffer)}`;
      } else {
        return Response.json(
          { ok: false, error: "Expected multipart/form-data request" },
          { status: 400 },
        );
      }

        let knownActorsText = "";
        if (actorsStr) {
          try {
            const actors = JSON.parse(actorsStr);
            if (Array.isArray(actors) && actors.length > 0) {
              knownActorsText = "\nHere is the list of known actors and their roles in this media:\n" + 
                actors.map((a: any) => `- ${a.name} (ID: ${a.id}) | Roles: ${a.roles.join(", ")}`).join("\n");
            }
          } catch (e) {
            console.error("Failed to parse actors:", e);
          }
        }
        
        let promptText = "Extract the list of actors, their roles, and their French voice actors from this dubbing credits image. Return a JSON object with an 'extract' property containing an array of objects. Each object should have 'actor' (the original actor name), 'role' (the character name), and 'voiceActor' (the French voice actor name). Only return valid JSON. If a column is missing, leave it empty.";
        if (knownActorsText) {
          promptText = `Extract the list of actors, their roles, and their French voice actors from this dubbing credits image.\nReturn a JSON object with an 'extract' property containing an array of objects.\nEach object should have 'actor' (the original actor name), 'role' (the character name), 'voiceActor' (the French voice actor name), and 'matchedActorId' (number or null, indicating the ID of the original actor from the known list below).\n\nTry to match the actors or roles from the image to the known list and include their ID in 'matchedActorId'. If a column is missing, leave it empty.${knownActorsText}`;
        }

        // We use pixtral-12b-2409 to parse the structured credits
        const mistralURL = "https://api.mistral.ai/v1/chat/completions";
        const mistralResponse = await fetch(mistralURL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("MISTRAL_TOKEN")}`,
          },
          body: JSON.stringify({
            model: "pixtral-12b-2409",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: promptText,
                  },
                {
                  type: "image_url",
                  image_url: {
                    url: imageBase64,
                  },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0, // deterministic
        }),
      });

      if (!mistralResponse.ok) {
        const errorText = await mistralResponse.text();
        console.error("Mistral API error:", errorText);
        return Response.json(
          { ok: false, error: `Mistral API error: ${mistralResponse.statusText}` },
          { status: mistralResponse.status },
        );
      }

      const mistralData = await mistralResponse.json();
      const content = mistralData.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error("No content returned from Mistral");
      }

      const parsed = JSON.parse(content);

      return Response.json({
        ok: true,
        result: parsed.extract || [],
      });
    } catch (error: any) {
      console.error("Error extracting credits:", error);
      return Response.json(
        { ok: false, error: error.message || "Internal server error" },
        { status: 500 },
      );
    }
  }),
};
