import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { purgeMediaByContentType } from "../_shared/cache-purge.ts";
import { igdbClient, wikipediaCache } from "../_shared/index.ts";
import { VoiceActorService } from "../_shared/voice-actor-service.ts";
import { findOrCreateDubbingProject } from "../_shared/dubbing-project.ts";
import { buildIgdbImageUrl } from "../_shared/igdb.ts";
import type {
  MistralMovieExtractOutput,
  IgdbCharacter,
} from "../_shared/types.ts";

export default {
  fetch: withSupabase<Database>(
    { auth: ["user", "secret"] },
    async (req, ctx) => {
      const voiceActorService = new VoiceActorService(ctx.supabaseAdmin);
      const lang = "fr";
      let gameTitle = "Unknown title";
      let igdbId: number;

      try {
        const body = await req.json();
        igdbId = Number(body.igdbId);
        if (isNaN(igdbId)) throw new Error("igdbId must be a number");
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
        // ─── Step 1: Fetch IGDB game + characters ───────────────────────────
        const [game, characters] = await Promise.all([
          igdbClient.getGame(igdbId),
          igdbClient.getGameCharacters(igdbId),
        ]);

        if (!game) {
          throw new Error(`IGDB game ${igdbId} not found`);
        }

        gameTitle = game.name;

        // Mark game as processed (creates dubbing_project row)
        await findOrCreateDubbingProject(
          ctx.supabaseAdmin,
          igdbId,
          "video_game",
        );

        let newVoiceActorsCount = 0;
        let newCreditsCount = 0;

        // ─── Step 2a: IGDB character voice actor matching ──────────────────
        // IGDB characters don't natively have a voice_actor_name field in the
        // API response, so we skip this track (IGDB removed structured VA data).
        // We proceed directly to the Wikipedia/Mistral extraction track below.
        // This comment is kept for future reference in case IGDB re-adds VA data.

        // ─── Step 2b: Wikipedia + Mistral credit extraction ────────────────
        // Look up the French Wikipedia page for this game by name
        const searchData = await wikipediaCache.searchWikidataEntities(
          game.name,
        );

        if (!searchData.search || searchData.search.length === 0) {
          return Response.json({
            ok: true,
            changes: 0,
            creditsAdded: 0,
            title: gameTitle,
            imageUrl: game.cover
              ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
              : undefined,
            note: "No Wikidata entry found for this game — skipping Wikipedia extraction.",
          });
        }

        // Pick the best Wikidata match (first result)
        const bestMatch = searchData.search[0];
        const entityData = await wikipediaCache.getWikidataEntity(bestMatch.id);
        const entity = entityData.entities[bestMatch.id];
        const wikipediaPageTitle = entity?.sitelinks?.[lang + "wiki"]?.title;

        if (!wikipediaPageTitle) {
          return Response.json({
            ok: true,
            changes: 0,
            creditsAdded: 0,
            title: gameTitle,
            imageUrl: game.cover
              ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
              : undefined,
            note: `No French Wikipedia page found for "${game.name}".`,
          });
        }

        const wikipediaPage = await wikipediaCache.getWikipediaPageInfo(
          wikipediaPageTitle,
          lang,
        );

        const firstPage = Object.keys(wikipediaPage.query.pages)[0];
        const wikipediaLangPageId = wikipediaPage.query.pages[firstPage].pageid;

        if (!wikipediaLangPageId) {
          throw new Error("Could not get page ID from Wikipedia search");
        }

        const wikipediaPageSections =
          await wikipediaCache.getPageSections(wikipediaLangPageId);

        const sections =
          wikipediaPageSections.parse.tocdata?.sections ||
          wikipediaPageSections.parse.sections ||
          [];

        // Match sections about voice/dubbing cast (same regex as prepare_media)
        const sectionIds = sections.filter(
          (section: { line: string; index: number }) =>
            section.line.match(/distribution|voix|casting|doublage/i),
        );

        // Build a character map (igdb name → character object) for actor_id lookup
        const characterMap = new Map(
          characters.map((c) => [c.name.toLowerCase(), c]),
        );

        for (const section of sectionIds) {
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
              messages: [{ role: "user", content: wikitext }],
              agent_id:
                "ag:4785a948:20241120:extracteur-page-film-wikipedia-doubleurs:31fc70f7",
              response_format: { type: "json_object" },
            }),
          });

          if (mistralJSONRequest.status === 429) {
            throw new Error("Mistral API Rate Limited (429)");
          }
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

          for (const entry of mistralSuggestionJSON?.items ?? []) {
            let { actor, voiceActorFirstname, voiceActorName } = entry;
            const { voiceActor } = entry as any;

            // Handle flat "voiceActor" field (some Mistral responses)
            if (voiceActor && !voiceActorFirstname && !voiceActorName) {
              const parts = voiceActor.trim().split(" ");
              if (parts.length > 0) {
                voiceActorFirstname = parts[0];
                voiceActorName = parts.slice(1).join(" ");
              }
            }

            if (!actor || !voiceActorFirstname || !voiceActorName) {
              console.log("Mistral entry missing required fields:", entry);
              continue;
            }

            // Find matching IGDB character to use as actor_id
            const igdbChar = characterMap.get(actor.toLowerCase());
            const actorId = igdbChar
              ? igdbChar.id
              : // Fall back to a hash-based ID if character not found in IGDB
                Math.abs(
                  actor
                    .split("")
                    .reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) | 0, 0),
                ) + 8_000_000_000;

            const result = await voiceActorService.insertVoiceActorAndWork(
              voiceActorFirstname,
              voiceActorName,
              igdbId,
              actorId,
              "video_game",
              entry.performance,
            );

            if (result.voiceActorResult.inserted) {
              newVoiceActorsCount++;
            }
            newCreditsCount++;
          }
        }

        console.log(
          `prepare_game complete. Added ${newCreditsCount} credits, ${newVoiceActorsCount} new voice actors.`,
        );

        await purgeMediaByContentType("game", igdbId);

        return Response.json({
          ok: true,
          changes: newVoiceActorsCount,
          creditsAdded: newCreditsCount,
          title: gameTitle,
          imageUrl: game.cover
            ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
            : undefined,
        });
      } catch (error) {
        console.error("Error processing prepare_game:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        return Response.json({ ok: false, error: errorMsg, title: gameTitle });
      }
    },
  ),
};
