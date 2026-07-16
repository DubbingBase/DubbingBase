import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import {
  getWikipediaPage,
  getImageFromFilename,
  WIKIPEDIA_USER_AGENT,
  getEntity,
} from "../_shared/extract/constants.ts";

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

      const wikiPageUrl = getWikipediaPage(title);
      const res = await fetch(wikiPageUrl, {
        headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
      });
      const data = await res.json();

      if (!data?.query?.pages) {
        return Response.json(
          { ok: false, error: "Wikipedia page not found" },
          { status: 404 },
        );
      }

      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];
      if (pageId === "-1") {
        return Response.json(
          { ok: false, error: "Wikipedia page not found" },
          { status: 404 },
        );
      }

      const pageprops = pages[pageId].pageprops || {};

      const extractUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&titles=${encodeURIComponent(title)}`;
      const extractRes = await fetch(extractUrl, {
        headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
      });
      const extractData = await extractRes.json();
      const extractText = extractData?.query?.pages?.[pageId]?.extract || "";

      const wikidataId = pageprops.wikibase_item;

      let firstname = "";
      let lastname = "";
      let profile_picture = null;
      let date_of_birth = null;
      let tmdb_id = null;

      // Default to parsing title for names if we can't get from Wikidata
      const decodedTitle = decodeURI(title).replace(/_/g, " ");
      const nameParts = decodedTitle.split(" ");
      firstname = nameParts[0];
      lastname = nameParts.slice(1).join(" ");

      if (wikidataId) {
        const entityUrl = getEntity(wikidataId);
        const entityRes = await fetch(entityUrl, {
          headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
        });
        const entityData = await entityRes.json();
        const entity = entityData.entities?.[wikidataId];

        if (entity) {
          const fullName = entity.labels?.fr?.value;
          if (fullName) {
            const parts = fullName.split(" ");
            firstname = parts[0];
            lastname = parts.slice(1).join(" ");
          }

          const imageClaim = entity.claims?.P18?.[0];
          if (imageClaim) {
            const filename = imageClaim.mainsnak.datavalue.value;
            const imageUrlRes = await fetch(getImageFromFilename(filename), {
              headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
            });
            const imageUrlData = await imageUrlRes.json();
            const imagePages = imageUrlData?.query?.pages;
            if (imagePages) {
              const imagePageId = Object.keys(imagePages)[0];
              profile_picture =
                imagePages[imagePageId]?.imageinfo?.[0]?.url || null;
            }
          }

          const dobClaim = entity.claims?.P569?.[0];
          if (dobClaim) {
            const timeStr = dobClaim.mainsnak.datavalue.value.time;
            if (timeStr) {
              date_of_birth = timeStr.replace(/^[+-]/, "").split("T")[0];
            }
          }

          const tmdbClaim = entity.claims?.P4985?.[0];
          if (tmdbClaim) {
            const tmdbStr = tmdbClaim.mainsnak.datavalue.value;
            if (tmdbStr) {
              tmdb_id = parseInt(tmdbStr, 10);
            }
          }
        }
      } else if (pageprops.page_image_free) {
        // Fallback to Wikipedia page_image_free if no Wikidata
        const imageUrlRes = await fetch(
          getImageFromFilename(pageprops.page_image_free),
          {
            headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
          },
        );
        const imageUrlData = await imageUrlRes.json();
        const imagePages = imageUrlData?.query?.pages;
        if (imagePages) {
          const imagePageId = Object.keys(imagePages)[0];
          profile_picture =
            imagePages[imagePageId]?.imageinfo?.[0]?.url || null;
        }
      }

      return Response.json({
        ok: true,
        result: {
          firstname,
          lastname,
          bio: extractText,
          profile_picture,
          date_of_birth,
          wikidata_id: wikidataId || null,
          tmdb_id: tmdb_id || null,
        },
      });
    } catch (error: any) {
      console.error("Error extracting voice actor info:", error);
      return Response.json(
        { ok: false, error: error.message || "Internal server error" },
        { status: 500 },
      );
    }
  }),
};
