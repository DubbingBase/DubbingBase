import { useWikipediaCache } from "../utils";
import { requireUser } from "../utils/auth";

const WIKIPEDIA_USER_AGENT =
  "DubbingBase/1.0 (https://dubbingbase.com; contact@dubbingbase.com)";

const dubbingTerm = [/doublag/i, /distribution/i, /voix/i, /casting/i];

function flatTocToTree(sections: any[]): Map<string, any> {
  const map = new Map<string, any>();
  for (const s of sections) {
    map.set(String(s.index), { ...s, children: [] });
  }
  for (const s of sections) {
    if (s.toclevel > 1) {
      const parent = map.get(String(s.index - 1));
      if (parent) parent.children.push(String(s.index));
    }
  }
  return map;
}

async function exploreDubbingSectionChilds(
  sectionIndex: string,
  toc: Map<string, any>,
  pageInfo: any,
): Promise<any[]> {
  const results: any[] = [];
  const section = toc.get(String(sectionIndex));
  if (!section) return results;

  if (section.children && section.children.length > 0) {
    for (const childIndex of section.children) {
      const childResults = await exploreDubbingSectionChilds(
        childIndex,
        toc,
        pageInfo,
      );
      results.push(...childResults);
    }
  } else {
    const url = `https://fr.wikipedia.org/w/api.php?action=parse&format=json&pageid=${pageInfo.pageid}&prop=wikitext&formatversion=2&section=${sectionIndex}`;
    const res = await fetch(url, {
      headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
    });
    if (res.ok) {
      const data = await res.json();
      results.push({
        type: section.line,
        html: data.parse?.wikitext || "",
        index: section.index,
      });
    }
  }
  return results;
}

export default defineEventHandler(async (event) => {
  requireUser(event);

  const lang = "fr";

  const body = await readBody(event);
  const { wikiId } = body as { wikiId: string };

  if (!wikiId) {
    throw createError({ statusCode: 400, message: "wikiId is required" });
  }

  const wikipediaCache = useWikipediaCache();
  const entity = await wikipediaCache.getWikidataEntity(wikiId);

  const wikipediaPageTitle =
    entity.entities[wikiId]?.sitelinks?.[lang + "wiki"]?.title;

  if (!wikipediaPageTitle) {
    throw createError({
      statusCode: 404,
      message: "Pas de page Wikipédia en français pour ce média.",
    });
  }

  const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(
    wikipediaPageTitle,
    lang,
  );

  const pages = wikipediaPage?.query?.pages || {};
  const firstPage = Object.keys(pages)[0];
  const wikipediaLangPageId = firstPage ? pages[firstPage]?.pageid : undefined;

  const wikipediaPageSections =
    await wikipediaCache.getPageSections(wikipediaLangPageId);

  let results: any[] = [];
  const sections =
    wikipediaPageSections.parse?.tocdata?.sections ||
    wikipediaPageSections.parse?.sections ||
    [];
  const toc = flatTocToTree(sections);
  for (const [sectionId, section] of toc) {
    if (dubbingTerm.some((rx) => rx.test(section.line))) {
      const _results = await exploreDubbingSectionChilds(section.index, toc, {
        pageid: wikipediaLangPageId,
        title: "test",
        ns: 0,
      });
      results.push(..._results);
    }
  }

  const filteredResults = results.filter(
    (x) => x.type !== "movie" && x.type !== "show",
  );

  const config = useRuntimeConfig();
  const extractedItems: any[] = [];

  for (const result of filteredResults.slice(0, 3)) {
    try {
      const mistralURL = "https://api.mistral.ai/v1/agents/completions";
      const mistralJSONRequest = await fetch(mistralURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.mistralToken}`,
        },
        body: JSON.stringify({
          stream: false,
          messages: [
            {
              role: "user",
              content: result.html,
            },
          ],
          agent_id:
            "ag:4785a948:20241126:extracteur-page-acteur-wikipedia-doubleurs:249748fe",
          response_format: {
            type: "json_object",
          },
        }),
      });

      if (mistralJSONRequest.ok) {
        const mistralJSON = await mistralJSONRequest.json();
        const mistralSuggestion = mistralJSON.choices?.[0]?.message?.content;
        if (mistralSuggestion) {
          const parsed = JSON.parse(mistralSuggestion);
          if (Array.isArray(parsed.items)) {
            extractedItems.push(...parsed.items);
          } else if (Array.isArray(parsed)) {
            extractedItems.push(...parsed);
          }
        }
      }
    } catch (mistralErr) {
      console.warn("Failed to extract section via Mistral:", mistralErr);
    }
  }

  return { ok: true, items: extractedItems };
});
