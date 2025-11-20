// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/http-utils.ts";
import { supabase } from "../_shared/database.ts";
import {
  getEntity,
  getWikipediaPage,
  getWikipediaPageSectionAsWikitext,
  wikipediaPageFindSections,
} from "../_shared/extract/constants.ts";
import { MistralMovieExtractOutput } from "../_shared/types.ts";
import { wikipediaCache } from "../_shared/index.ts";
import { WithCast } from "../_shared/types.ts";
import { Database } from "../_shared/database.types.ts";
import { PostgrestError } from "jsr:@supabase/supabase-js";

import { VoiceActorService } from "../_shared/voice-actor-service.ts";

const voiceActorService = new VoiceActorService();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const lang = "fr";

  const { tmdbId, type } = await req.json() as {
    tmdbId: number;
    type: "movie" | "tv";
  };

  const response = await fetch(
    `https://api.themoviedb.org/3/${type}/${tmdbId}?append_to_response=credits,external_ids&language=fr-FR`,
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("TMDB_API_KEY")}`,
        "Accept": "application/json",
      },
    },
  );

  const movie = await response.json() as WithCast;

  const wikiId = movie.external_ids?.wikidata_id;

  if (!wikiId) {
    console.error("Could not find wikidata_id", { tmdbId, type });
    return Response.json(
      {
        ok: false,
        error: "Could not find wikidata_id",
        tmdbId,
        type,
      },
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  // Use cached Wikidata entity fetch
  const entity = await wikipediaCache.getWikidataEntity(wikiId);

  const wikipediaPageTitle = entity.entities[wikiId]?.sitelinks?.[lang + "wiki"]
    ?.title;

  console.log("wikipediaPageTitle", wikipediaPageTitle);

  if (!wikipediaPageTitle) {
    console.error("wikipediaPageTitle is undefined");
    return Response.json(
      {
        ok: false,
        error: "wikipediaPageTitle is undefined",
        lang,
        wikiId,
        tmdbId,
        type,
      },
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  // Use cached Wikipedia page info fetch
  const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(
    wikipediaPageTitle,
    lang,
  );

  const firstPage = Object.keys(wikipediaPage.query.pages)[0];

  const wikipediaLangPageId = wikipediaPage.query.pages[firstPage].pageid;

  // Use cached Wikipedia page sections fetch
  const wikipediaPageSections = await wikipediaCache.getPageSections(
    wikipediaLangPageId,
  );

  console.log("wikipediaPageSections", wikipediaPageSections);
  const sectionIds = wikipediaPageSections.parse.sections.filter(
    (section: any) => {
      return section.line.match(/distribution/i);
    },
  );

  for (const section of sectionIds) {
    console.log("section", section);

    // Use cached Wikipedia page section fetch
    const wikitextJSON = await wikipediaCache.getPageSectionAsWikitext(
      wikipediaLangPageId,
      section.index,
    );
    const wikitext = wikitextJSON.parse.wikitext;

    const mistralURL = "https://api.mistral.ai/v1/agents/completions";
    const mistralJSONRequest = await fetch(mistralURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("MISTRAL_TOKEN")}`,
      },
      body: JSON.stringify({
        "stream": false,
        "messages": [
          {
            "role": "user",
            "content": wikitext,
          },
        ],
        "agent_id":
          "ag:4785a948:20241120:extracteur-page-film-wikipedia-doubleurs:31fc70f7",
        "response_format": {
          "type": "json_object",
        },
      }),
    });

    const mistralJSON = await mistralJSONRequest.json();

    const mistralSuggestion = mistralJSON.choices[0].message.content;
    const mistralSuggestionJSON = JSON.parse(
      mistralSuggestion,
    ) as MistralMovieExtractOutput;

    console.log("mistralSuggestion", mistralSuggestionJSON);

    console.log("movie", movie);

    for (const entry of mistralSuggestionJSON?.items ?? []) {
      const { actor, voiceActorFirstname, voiceActorName } = entry;

      if (actor && voiceActorFirstname && voiceActorName) {
        // get actor id from the movie cast
        const foundActor = movie.credits.cast.find((cast) =>
          cast.name === actor
        );

        if (!foundActor) {
          console.log(`actor from wikitext "${actor}" not found in tmdb cast`);
          continue;
        }

        const { id: actorId } = foundActor;

        await voiceActorService.insertVoiceActorAndWork(
          voiceActorFirstname,
          voiceActorName,
          tmdbId,
          actorId,
          type,
          entry.performance,
        );
      } else {
        console.error("mistral missing structure", entry);
      }
    }
  }

  console.log("done");

  const result = { ok: true };
  return Response.json(result, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
});
