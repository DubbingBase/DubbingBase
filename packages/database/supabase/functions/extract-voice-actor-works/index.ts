import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { WIKIPEDIA_USER_AGENT } from "../_shared/extract/constants.ts";
import { geminiGenerateObject } from "../_shared/index.ts";
import { z } from "npm:zod";

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

      const schema = z.object({
        extract: z.array(z.object({
          originalTitle: z.string(),
          frenchTitle: z.string(),
          character: z.string(),
          type: z.string(),
          originalActor: z.string(),
        })),
      });

      const parsed = await geminiGenerateObject(
        extractText.substring(0, 30000),
        schema,
        {
          systemInstruction: `You are an expert at extracting filmographies and dubbing roles from French Wikipedia articles. Extract the filmography (dubbing roles) from the article text.`,
          temperature: 0,
        },
      );

      return Response.json({
        ok: true,
        result: parsed.extract,
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
