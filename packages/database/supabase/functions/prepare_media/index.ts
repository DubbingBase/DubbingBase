import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { MistralMovieExtractOutput } from "../_shared/types.ts";
import { wikipediaCache } from "../_shared/index.ts";
import { WithCast } from "../_shared/types.ts";
import { VoiceActorService } from "../_shared/voice-actor-service.ts";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>(
    { auth: ["user", "secret"] },
    async (req, ctx) => {
      const voiceActorService = new VoiceActorService(ctx.supabaseAdmin);
      const lang = "fr";

      let tmdbId: number;
      let type: "movie" | "tv" | "season" | "episode";
      let seasonNumber: number | null = null;
      let episodeNumber: number | null = null;

      try {
        const body = await req.json();
        tmdbId = Number(body.tmdbId);
        type = body.type;
        if (body.seasonNumber !== undefined && body.seasonNumber !== null) {
          seasonNumber = Number(body.seasonNumber);
        }
        if (body.episodeNumber !== undefined && body.episodeNumber !== null) {
          episodeNumber = Number(body.episodeNumber);
        }
      } catch (err) {
        return Response.json(
          {
            ok: false,
            error:
              "Invalid request payload: " +
              (err instanceof Error ? err.message : String(err)),
          },
          { status: 400 },
        );
      }

      try {
        // Map 'season' and 'episode' to 'tv' for the TMDB api call
        const tmdbType = type === "season" || type === "episode" ? "tv" : type;

        const response = await fetch(
          `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?append_to_response=credits,external_ids&language=fr-FR`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("TMDB_API_KEY")}`,
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch from TMDB API: status ${response.status}`,
          );
        }

        const movie = (await response.json()) as any;
        const wikiId = movie.external_ids?.wikidata_id;

        if (!wikiId) {
          throw new Error(
            "Could not find wikidata_id associated with this TMDB ID",
          );
        }

        // Use cached Wikidata entity fetch
        const entity = await wikipediaCache.getWikidataEntity(wikiId);
        const wikipediaPageTitle =
          entity.entities[wikiId]?.sitelinks?.[lang + "wiki"]?.title;

        console.log("wikipediaPageTitle", wikipediaPageTitle);

        if (!wikipediaPageTitle) {
          throw new Error("Pas de page Wikipédia en français pour ce média.");
        }

        // Use cached Wikipedia page info fetch
        const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(
          wikipediaPageTitle,
          lang,
        );

        const firstPage = Object.keys(wikipediaPage.query.pages)[0];
        const wikipediaLangPageId = wikipediaPage.query.pages[firstPage].pageid;

        if (!wikipediaLangPageId) {
          throw new Error("Could not get page ID from Wikipedia search");
        }

        // Use cached Wikipedia page sections fetch
        const wikipediaPageSections =
          await wikipediaCache.getPageSections(wikipediaLangPageId);

        console.log("wikipediaPageSections", wikipediaPageSections);
        const sections =
          wikipediaPageSections.parse.tocdata?.sections ||
          wikipediaPageSections.parse.sections ||
          [];

        const sectionIds = sections.filter(
          (section: { line: string; index: number }) => {
            return section.line.match(/distribution/i);
          },
        );

        let newVoiceActorsCount = 0;

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
              Authorization: `Bearer ${Deno.env.get("MISTRAL_TOKEN")}`,
            },
            body: JSON.stringify({
              stream: false,
              messages: [
                {
                  role: "user",
                  content: wikitext,
                },
              ],
              agent_id:
                "ag:4785a948:20241120:extracteur-page-film-wikipedia-doubleurs:31fc70f7",
              response_format: {
                type: "json_object",
              },
            }),
          });

          if (!mistralJSONRequest.ok) {
            throw new Error(
              `Mistral API request failed with status ${mistralJSONRequest.status}`,
            );
          }

          const mistralJSON = await mistralJSONRequest.json();
          const mistralSuggestion = mistralJSON.choices[0].message.content;
          const mistralSuggestionJSON = JSON.parse(
            mistralSuggestion,
          ) as MistralMovieExtractOutput;

          console.log("mistralSuggestion", mistralSuggestionJSON);
          console.log("movie", movie);

          for (const entry of mistralSuggestionJSON?.items ?? []) {
            let { actor, voiceActorFirstname, voiceActorName } = entry;
            const { voiceActor } = entry as any;

            if (voiceActor && !voiceActorFirstname && !voiceActorName) {
              const parts = voiceActor.trim().split(" ");
              if (parts.length > 0) {
                voiceActorFirstname = parts[0];
                voiceActorName = parts.slice(1).join(" ");
              }
            }

            if (actor && voiceActorFirstname && voiceActorName) {
              // get actor id from the movie cast
              const foundActor = movie.credits.cast.find(
                (cast: any) => cast.name === actor,
              );

              if (!foundActor) {
                console.log(
                  `actor from wikitext "${actor}" not found in tmdb cast`,
                );
                continue;
              }

              const { id: actorId } = foundActor;

              const result = await voiceActorService.insertVoiceActorAndWork(
                voiceActorFirstname,
                voiceActorName,
                tmdbId,
                actorId,
                tmdbType, // Insert work entry as tmdbType (tv/movie)
                entry.performance,
              );

              if (result.voiceActorResult.inserted) {
                newVoiceActorsCount++;
              }
            } else {
              console.error("mistral missing structure", entry);
            }
          }
        }

        console.log(
          `Processing complete. Added ${newVoiceActorsCount} new voice actors.`,
        );

        const result = { ok: true, changes: newVoiceActorsCount };
        return Response.json(result);
      } catch (error) {
        console.error("Error processing fetch request:", error);

        const errorMsg = error instanceof Error ? error.message : String(error);

        return Response.json({ ok: false, error: errorMsg });
      }
    },
  ),
};
