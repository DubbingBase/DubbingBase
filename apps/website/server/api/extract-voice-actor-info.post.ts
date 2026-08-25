import { requireAdmin } from "../utils/auth";

const WIKIPEDIA_USER_AGENT =
  "DubbingBase/1.0 (https://dubbingbase.com; contact@dubbingbase.com)";

function getWikipediaPage(title: string, language: string) {
  return `https://${language}.wikipedia.org/w/api.php?action=query&prop=pageprops&format=json&titles=${encodeURIComponent(title)}`;
}

function getEntity(entityId: string, language: string) {
  const sitefilter = `${language.replace(/-/g, "_")}wiki`;
  return `https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks%7Clabels&format=json&ids=${entityId}&sitefilter=${sitefilter}`;
}

function getImageFromFilename(filename: string, lang: string) {
  return `https://${lang}.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json`;
}

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
  let lang: string;
  try {
    const urlObj = new URL(wikipediaUrl);
    const splitParts = urlObj.pathname.split("/wiki/");
    title = decodeURIComponent(splitParts[1] || "");
    const langMatch = urlObj.hostname.match(
      /^(?:www\.)?([a-z]{2,3}(?:-[a-z0-9]+)?|simple)(?:\.m)?\.wikipedia\.org$/,
    );
    if (!langMatch?.[1]) {
      throw new Error("Could not detect language from Wikipedia URL hostname");
    }
    lang = langMatch[1];
    if (!title) {
      throw new Error("Invalid Wikipedia URL format");
    }
  } catch (e) {
    throw createError({ statusCode: 400, message: "Invalid Wikipedia URL" });
  }

  try {
    const wikiPageUrl = getWikipediaPage(title, lang);
    const res = await fetch(wikiPageUrl, {
      headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
    });
    const data = await res.json();

    if (!data?.query?.pages) {
      throw createError({
        statusCode: 404,
        message: "Wikipedia page not found",
      });
    }

    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0] || "";
    if (pageId === "-1" || !pageId) {
      throw createError({
        statusCode: 404,
        message: "Wikipedia page not found",
      });
    }

    const pageprops = pages[pageId]?.pageprops || {};

    const extractUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&titles=${encodeURIComponent(title)}`;
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

    const decodedTitle = decodeURI(title).replace(/_/g, " ");
    const nameParts = decodedTitle.split(" ");
    firstname = nameParts[0] || "";
    lastname = nameParts.slice(1).join(" ");

    if (wikidataId) {
      const entityUrl = getEntity(wikidataId, lang);
      const entityRes = await fetch(entityUrl, {
        headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
      });
      const entityData = await entityRes.json();
      const entity = entityData.entities?.[wikidataId];

      if (entity) {
        const fullName =
          entity.labels?.[lang]?.value || entity.labels?.en?.value;
        if (fullName) {
          const parts = fullName.split(" ");
          firstname = parts[0] || "";
          lastname = parts.slice(1).join(" ");
        }

        const imageClaim = entity.claims?.P18?.[0];
        if (imageClaim) {
          const filename = imageClaim.mainsnak?.datavalue?.value;
          if (filename) {
            const imageUrlRes = await fetch(
              getImageFromFilename(filename, lang),
              {
                headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
              },
            );
            const imageUrlData = await imageUrlRes.json();
            const imagePages = imageUrlData?.query?.pages;
            if (imagePages) {
              const imagePageId = Object.keys(imagePages)[0] || "";
              profile_picture =
                imagePages[imagePageId]?.imageinfo?.[0]?.url || null;
            }
          }
        }

        const dobClaim = entity.claims?.P569?.[0];
        if (dobClaim) {
          const timeStr = dobClaim.mainsnak?.datavalue?.value?.time;
          if (timeStr) {
            date_of_birth = timeStr.replace(/^[+-]/, "").split("T")[0] || null;
          }
        }

        const tmdbClaim = entity.claims?.P4985?.[0];
        if (tmdbClaim) {
          const tmdbStr = tmdbClaim.mainsnak?.datavalue?.value;
          if (tmdbStr) {
            tmdb_id = parseInt(tmdbStr, 10);
          }
        }
      }
    } else if (pageprops.page_image_free) {
      const imageUrlRes = await fetch(
        getImageFromFilename(pageprops.page_image_free, lang),
        {
          headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
        },
      );
      const imageUrlData = await imageUrlRes.json();
      const imagePages = imageUrlData?.query?.pages;
      if (imagePages) {
        const imagePageId = Object.keys(imagePages)[0] || "";
        profile_picture = imagePages[imagePageId]?.imageinfo?.[0]?.url || null;
      }
    }

    return {
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
    };
  } catch (error: any) {
    console.error("Error extracting voice actor info:", error);
    if (error instanceof Error && "statusCode" in error) throw error;
    throw createError({
      statusCode: 500,
      message: error.message || "Internal server error",
    });
  }
});
