import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { dubbingTerm } from "../_shared/extract/constants.ts";
import {
  getEntity,
  getWikipediaPage,
  getWikipediaPageSectionAsWikitext,
  wikipediaPageFindSections,
} from "../_shared/extract/constants.ts";
import { flatTocToTree } from "./toc.ts";
import { exploreDubbingSectionChilds } from "./extract.ts";
import { wikipediaCache, geminiGenerateObject } from "../_shared/index.ts";
import { z } from "npm:zod";

export default {
  fetch: withSupabase<Database>(
    { auth: ["user", "secret"] },
    async (req, _ctx) => {
      const lang = "fr";

      const rq = (await req.json()) as {
        wikiId: string;
      };

      console.log("rq", rq);

      const { wikiId } = rq;

      console.log("wikiId", wikiId);

      // Use cached Wikidata entity fetch
      const entity = await wikipediaCache.getWikidataEntity(wikiId);

      const wikipediaPageTitle =
        entity.entities[wikiId].sitelinks[lang + "wiki"].title;

      if (!wikipediaPageTitle) {
        console.error("wikipediaPageTitle is undefined");
        return Response.json({
          ok: false,
          error: "Pas de page Wikipédia en français pour ce média.",
        });
      }

      // Use cached Wikipedia page info fetch
      const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(
        wikipediaPageTitle,
        lang,
      );

      const firstPage = Object.keys(wikipediaPage.query.pages)[0];
      const wikipediaLangPageId = wikipediaPage.query.pages[firstPage].pageid;

      // Use cached Wikipedia page sections fetch
      const wikipediaPageSections =
        await wikipediaCache.getPageSections(wikipediaLangPageId);

      console.log("wikipediaPageSections", wikipediaPageSections);

      let sectionFound = false;
      let results: any[] = [];
      const sections =
        wikipediaPageSections.parse.tocdata?.sections ||
        wikipediaPageSections.parse.sections ||
        [];
      const toc = flatTocToTree(sections);
      for (const [sectionId, section] of toc) {
        // find dubbing section
        if (dubbingTerm.some((rx) => rx.test(section.line))) {
          sectionFound = true;
          const _results = await exploreDubbingSectionChilds(
            section.index,
            toc,
            {
              pageid: wikipediaLangPageId,
              title: "test",
              ns: 0,
            },
          );
          results.push(..._results);
        }
      }

      console.log("results", JSON.stringify(results, undefined, 2));

      // skip other than movie and show
      const filteredResults = results.filter(
        (x) => x.type !== "movie" && x.type !== "show",
      );

      for (const result of filteredResults.slice(0, 1)) {
        const schema = z.object({
          items: z.array(z.object({
            actor: z.string(),
            performance: z.string().optional(),
            production: z.string().optional(),
            year: z.number().nullable().optional(),
          })).optional(),
        });

        const llmSuggestionJSON = await geminiGenerateObject(
          result.html,
          schema,
          {
            systemInstruction: `You are an expert at extracting dubbing data from French Wikipedia pages. Extract the dubbing data from the provided text.`,
            temperature: 0,
          },
        );

        console.log("llmSuggestion", llmSuggestionJSON);
      }

      return Response.json({ ok: true });
    },
  ),
};
