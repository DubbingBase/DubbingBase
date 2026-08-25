import { useWikipediaCache } from "../utils";
import { requireUser } from "../utils/auth";
import { llmGenerateObject } from "../utils/llm";
import { z } from "zod";

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

  const extractedItems: any[] = [];

  for (const result of filteredResults.slice(0, 3)) {
    try {
      const schema = z.object({
        items: z.array(z.object({
          actor: z.string(),
          performance: z.string().optional(),
          production: z.string().optional(),
          year: z.number().nullable().optional(),
        })).optional(),
      });

      const llmSuggestionJSON = await llmGenerateObject(result.html, schema, {
        systemInstruction: `You are an expert at extracting dubbing data from French Wikipedia pages. Extract the dubbing data from the provided text.`,
        temperature: 0,
      });

      if (Array.isArray(llmSuggestionJSON?.items)) {
        extractedItems.push(...llmSuggestionJSON.items);
      } else if (Array.isArray(llmSuggestionJSON)) {
        extractedItems.push(...(llmSuggestionJSON as any[]));
      }
    } catch (err) {
      console.warn("Failed to extract section via LLM:", err);
    }
  }

  return { ok: true, items: extractedItems };
});
