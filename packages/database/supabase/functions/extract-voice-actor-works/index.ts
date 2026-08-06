import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { WIKIPEDIA_USER_AGENT } from "../_shared/extract/constants.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 },
        );
      }

      const isAdmin =
        user.appMetadata?.role === "admin" ||
        user.userMetadata?.role === "admin" ||
        user.role === "admin";

      if (!isAdmin) {
        return Response.json(
          { ok: false, error: "Forbidden" },
          { status: 403 },
        );
      }

      const body = await req.json();
      const { wikipediaUrl } = body;

      if (!wikipediaUrl) {
        return Response.json(
          { ok: false, error: "wikipediaUrl is required" },
          { status: 400 },
        );
      }

      let title = "";
      try {
        const urlObj = new URL(wikipediaUrl);
        title = decodeURIComponent(urlObj.pathname.split("/wiki/")[1]);
        if (!title) {
          throw new Error("Invalid Wikipedia URL format");
        }
      } catch (e) {
        return Response.json(
          { ok: false, error: "Invalid Wikipedia URL" },
          { status: 400 },
        );
      }

      // Fetch the full text extract from Wikipedia
      const extractUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(title)}`;
      const extractRes = await fetch(extractUrl, {
        headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
      });
      const extractData = await extractRes.json();

      const pages = extractData?.query?.pages;
      if (!pages) {
        return Response.json(
          { ok: false, error: "Wikipedia page not found" },
          { status: 404 },
        );
      }

      const pageId = Object.keys(pages)[0];
      if (pageId === "-1") {
        return Response.json(
          { ok: false, error: "Wikipedia page not found" },
          { status: 404 },
        );
      }

      const extractText = pages[pageId]?.extract || "";

      if (!extractText) {
        return Response.json(
          { ok: false, error: "Could not extract text from Wikipedia page" },
          { status: 404 },
        );
      }

      const promptText = `
You are an expert at extracting filmographies and dubbing roles from French Wikipedia articles.
Here is the text of a Wikipedia article about a French voice actor. 
Extract their filmography (dubbing roles) and return a JSON object with an 'extract' property containing an array of objects. 
Each object should have:
- 'originalTitle' (the original title of the media, if available, otherwise French title)
- 'frenchTitle' (the French title of the media)
- 'character' (the character name they voiced)
- 'type' ("movie", "serie", "animation", or "game")
- 'originalActor' (the original actor they dubbed, if applicable, otherwise empty string)

Return ONLY valid JSON. 

Article Text:
${extractText.substring(0, 30000)} // Truncating just in case, but usually articles are not > 30k chars
`;

      const mistralURL = "https://api.mistral.ai/v1/chat/completions";
      const mistralResponse = await fetch(mistralURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("MISTRAL_TOKEN")}`,
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: promptText,
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
        }),
      });

      if (!mistralResponse.ok) {
        const errorText = await mistralResponse.text();
        console.error("Mistral API error:", errorText);
        return Response.json(
          {
            ok: false,
            error: `Mistral API error: ${mistralResponse.statusText}`,
          },
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
      console.error("Error extracting voice actor works:", error);
      return Response.json(
        { ok: false, error: error.message || "Internal server error" },
        { status: 500 },
      );
    }
  }),
};
