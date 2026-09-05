import { llmVisionObject } from "../utils/llm";
import { z } from "zod";

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event);

    if (!formData) {
      throw createError({
        statusCode: 400,
        message: "Expected multipart/form-data request",
      });
    }

    const imageField = formData.find((f) => f.name === "image");
    const actorsField = formData.find((f) => f.name === "actors");

    if (!imageField || !imageField.data) {
      throw createError({
        statusCode: 400,
        message: "Missing required parameter: image",
      });
    }

    const mimeType = imageField.type || "image/jpeg";
    const imageBase64 = `data:${mimeType};base64,${imageField.data.toString("base64")}`;

    let knownActorsText = "";
    if (actorsField?.data) {
      try {
        const actors = JSON.parse(actorsField.data.toString());
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
      "Extract the list of actors, their roles, and their French voice actors from this dubbing credits image. Return a JSON object with an 'extract' property containing an array of objects. Each object should have 'actor' (the original actor name), 'role' (the character name), and 'voiceActor' (the French voice actor name). Only return valid JSON. If a column is missing, leave it empty.";

    const baseCreditSchema = z.object({
      actor: z.string(),
      role: z.string(),
      voiceActor: z.string(),
    });

    if (knownActorsText) {
      promptText = `Extract the list of actors, their roles, and their French voice actors from this dubbing credits image.\nReturn a JSON object with an 'extract' property containing an array of objects.\nEach object should have 'actor' (the original actor name), 'role' (the character name), 'voiceActor' (the French voice actor name), and 'matchedActorId' (number or null, indicating the ID of the original actor from the known list below).\n\nTry to match the actors or roles from the image to the known list and include their ID in 'matchedActorId'. If a column is missing, leave it empty.${knownActorsText}`;

      const schemaWithMatch = z.object({
        extract: z.array(
          baseCreditSchema.extend({
            matchedActorId: z.number().nullable(),
          }),
        ),
      });

      const parsed = await llmVisionObject(
        promptText,
        imageBase64,
        schemaWithMatch,
        mimeType,
        {
          temperature: 0,
        },
      );

      return {
        ok: true,
        result: parsed.data.extract,
        llmModel: parsed.model,
        llmQuota: parsed.quota,
      };
    }

    const schema = z.object({
      extract: z.array(baseCreditSchema),
    });

    const parsed = await llmVisionObject(
      promptText,
      imageBase64,
      schema,
      mimeType,
      {
        temperature: 0,
      },
    );

    return {
      ok: true,
      result: parsed.data.extract,
      llmModel: parsed.model,
      llmQuota: parsed.quota,
    };
  } catch (error: any) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Error extracting credits:", error);
    throw createError({
      statusCode: 500,
      message: error.message || "Internal server error",
    });
  }
});
