import { requireAdmin } from "../utils/auth";

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
      const config = useRuntimeConfig();
      const mistralToken = config.mistralToken as string;

      if (mistralToken) {
        const mistralUrl = "https://api.mistral.ai/v1/chat/completions";
        const prompt = `Extrais la liste des œuvres doublées, le personnage et l'acteur original depuis ce texte Wikipédia en format JSON structuré avec un tableau "works" contenant: mediaTitle, mediaType (movie ou tv), characterName, originalActorName.
        
Texte:
${dubbingText.slice(0, 4000)}`;

        const mistralRes = await fetch(mistralUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mistralToken}`,
          },
          body: JSON.stringify({
            model: "mistral-small-latest",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });

        if (mistralRes.ok) {
          const mistralData = await mistralRes.json();
          const content = mistralData.choices?.[0]?.message?.content;
          if (content) {
            try {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed.works)) {
                works.push(...parsed.works);
              }
            } catch (jsonErr) {
              console.warn(
                "Failed to parse Mistral response as JSON:",
                jsonErr,
              );
            }
          }
        }
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
