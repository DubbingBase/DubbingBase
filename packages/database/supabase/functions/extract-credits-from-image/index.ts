import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { geminiVisionObject } from "../_shared/index.ts";
import { z } from "npm:zod";

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
            knownActorsText =
              "\nHere is the list of known actors and their roles in this media:\n" +
              actors
                .map(
                  (a: any) =>
                    `- ${a.name} (ID: ${a.id}) | Roles: ${a.roles.join(", ")}`,
                )
                .join("\n");
          }
        } catch (e) {
          console.error("Failed to parse actors:", e);
        }
      }

      let promptText =
        "Extract the list of actors, their roles, and their French voice actors from this dubbing credits image. If a column is missing, leave it empty.";

      const baseCreditSchema = z.object({
        actor: z.string(),
        role: z.string(),
        voiceActor: z.string(),
      });

      if (knownActorsText) {
        promptText = `Extract the list of actors, their roles, and their French voice actors from this dubbing credits image.
Try to match the actors or roles from the image to the known list and include their ID in 'matchedActorId'. If a column is missing, leave it empty.${knownActorsText}`;

        const schemaWithMatch = z.object({
          extract: z.array(
            baseCreditSchema.extend({
              matchedActorId: z.number().nullable(),
            }),
          ),
        });

        const parsed = await geminiVisionObject(
          promptText,
          imageBase64,
          schemaWithMatch,
        );

        return Response.json({
          ok: true,
          result: parsed.extract,
        });
      }

      const schema = z.object({
        extract: z.array(baseCreditSchema),
      });

      const parsed = await geminiVisionObject(promptText, imageBase64, schema);

      return Response.json({
        ok: true,
        result: parsed.extract,
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
