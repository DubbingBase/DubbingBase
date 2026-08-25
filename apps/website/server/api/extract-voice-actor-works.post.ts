import { requireAdmin } from "../utils/auth";
import { llmGenerateObject } from "../utils/llm";
import { z } from "zod";

const WIKIPEDIA_USER_AGENT =
  "DubbingBase/1.0 (https://dubbingbase.com; contact@dubbingbase.com)";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const body = await readBody(event);
  const { wikipediaUrl } = body;

  if (!wikipediaUrl) {
    throw createError({
      statusCode: 400,
      message: "wikipediaUrl is required",
    });
  }

  let title = "";
  try {
    const urlObj = new URL(wikipediaUrl);
    const splitParts = urlObj.pathname.split("/wiki/");
    title = decodeURIComponent(splitParts[1] || "");
    if (!title) {
      throw new Error("Invalid Wikipedia URL format");
    }
  } catch (e) {
    throw createError({ statusCode: 400, message: "Invalid Wikipedia URL" });
  }

  try {
    const extractUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(title)}`;
    const extractRes = await fetch(extractUrl, {
      headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
    });
    const extractData = await extractRes.json();

    const pages = extractData?.query?.pages;
    if (!pages) {
      throw createError({
        statusCode: 404,
        message: "Wikipedia page not found",
      });
    }

    const pageId = Object.keys(pages)[0] || "";
    if (pageId === "-1" || !pageId) {
      throw createError({
        statusCode: 404,
        message: "Wikipedia page not found",
      });
    }

    const fullText = pages[pageId]?.extract || "";

    const lines = fullText.split("\n");
    let inDubbingSection = false;
    const dubbingLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("==") &&
        (trimmed.toLowerCase().includes("doublage") ||
          trimmed.toLowerCase().includes("voix"))
      ) {
        inDubbingSection = true;
        continue;
      }
      if (inDubbingSection) {
        if (
          trimmed.startsWith("==") &&
          !trimmed.toLowerCase().includes("doublage") &&
          !trimmed.toLowerCase().includes("voix")
        ) {
          break;
        }
        if (trimmed) {
          dubbingLines.push(trimmed);
        }
      }
    }

    const dubbingText = dubbingLines.join("\n");

    const works: any[] = [];
    if (dubbingText) {
      const schema = z.object({
        works: z.array(z.object({
          mediaTitle: z.string(),
          mediaType: z.string(),
          characterName: z.string(),
          originalActorName: z.string(),
        })).optional(),
      });

      try {
        const prompt = `Extract the list of dubbed works, the character and the original actor from this Wikipedia text in structured JSON format with a "works" array containing: mediaTitle, mediaType (movie or tv), characterName, originalActorName.

Text:
${dubbingText.slice(0, 4000)}`;

        const parsed = await llmGenerateObject(prompt, schema, {
          systemInstruction: `You are an expert at extracting dubbing data from French Wikipedia pages. Extract the dubbing data from the provided text.`,
          temperature: 0,
        });

        if (Array.isArray(parsed.works)) {
          works.push(...parsed.works);
        }
      } catch (err) {
        console.warn("Failed to extract works via LLM:", err);
      }
    }

    return {
      ok: true,
      result: {
        raw_text: dubbingText,
        works,
      },
    };
  } catch (error: any) {
    console.error("Error extracting voice actor works:", error);
    if (error instanceof Error && "statusCode" in error) throw error;
    throw createError({
      statusCode: 500,
      message: error.message || "Internal server error",
    });
  }
});
