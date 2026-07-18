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
import { MistralVoiceActorExtractOutput } from "../_shared/types.ts";
import { wikipediaCache } from "../_shared/index.ts";

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
          error: "wikipediaPageTitle is undefined",
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
      const toc = flatTocToTree(wikipediaPageSections.parse.sections);
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
        const mistralURL = "https://api.mistral.ai/v1/agents/completions";
        const mistralJSONRequest = await fetch(mistralURL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("MISTRAL_TOKEN")}`,
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

        const mistralJSON = await mistralJSONRequest.json();
        const mistralSuggestion = mistralJSON.choices[0].message.content;
        const mistralSuggestionJSON = JSON.parse(
          mistralSuggestion,
        ) as MistralVoiceActorExtractOutput;

        console.log("mistralSuggestion", mistralSuggestionJSON);
      }

      return Response.json({ ok: true });
    },
  ),
};
