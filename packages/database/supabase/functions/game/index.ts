import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import {
  igdbClient,
  cacheUtils,
  DatabaseClient,
  getParams,
} from "../_shared/index.ts";
import { buildIgdbImageUrl } from "../_shared/igdb.ts";
import type {
  GameMedia,
  GameDetailResponse,
  DubbingProject,
  WorkPerformance,
  VoiceActorSummary,
  CharacterProfilePicture,
  VoteData,
  IgdbCover,
  IgdbPlatform,
  IgdbInvolvedCompany,
  IgdbCompany,
  IgdbCharacter,
  IgdbMugShot,
  IgdbGenre,
} from "../_shared/media-types.ts";

// Transform IGDB game to lean GameMedia
function transformGameToMedia(game: any): GameMedia {
  return {
    id: game.id,
    title: game.name,
    overview: game.summary || "",
    poster_path: game.cover
      ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
      : null,
    backdrop_path: game.cover
      ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
      : null,
    vote_average: game.rating || 0,
    vote_count: game.rating_count || 0,
    genres:
      game.genres?.map((g: IgdbGenre) => ({ id: g.id, name: g.name })) || [],
    credits: { cast: [] },
    external_ids: { imdb_id: null, wikidata_id: null },
    media_type: "video_game",
    first_release_date: game.first_release_date ?? null,
    summary: game.summary || "",
    cover: game.cover
      ? {
          image_id: game.cover.image_id,
          url: buildIgdbImageUrl(game.cover.image_id, "cover_big"),
        }
      : null,
    platforms:
      game.platforms?.map((p: IgdbPlatform) => ({
        id: p.id,
        name: p.name,
        abbreviation: p.abbreviation,
      })) || [],
    involved_companies:
      game.involved_companies?.map((ic: IgdbInvolvedCompany) => ({
        id: ic.id,
        company: {
          id: ic.company.id,
          name: ic.company.name,
          logo: ic.company.logo
            ? buildIgdbImageUrl(ic.company.logo.image_id, "logo_med")
            : null,
        },
        developer: ic.developer,
        publisher: ic.publisher,
        porting: ic.porting,
        supporting: ic.supporting,
      })) || [],
    characters:
      game.characters?.map((c: IgdbCharacter) => ({
        id: c.id,
        name: c.name,
        mug_shot: c.mug_shot
          ? {
              image_id: c.mug_shot.image_id,
              url: buildIgdbImageUrl(c.mug_shot.image_id, "1080p"),
            }
          : null,
      })) || [],
  };
}

function transformDubbingProjects(projects: any[], ctx: any): DubbingProject[] {
  return projects.map((p) => ({
    id: p.id,
    content_id: p.content_id,
    content_type: p.content_type,
    language: p.language,
    studio_id: p.studio_id,
    studio_data: p.studio_data
      ? {
          id: p.studio_data.id,
          name: p.studio_data.name,
          logo: p.studio_data.logo,
          website: p.studio_data.website,
        }
      : null,
    status: p.status,
    works:
      p.works?.map((w: any) => ({
        id: w.id,
        actor_id: w.actor_id,
        voice_actor_id: w.voice_actor_id,
        highlight: w.highlight,
        suggestions: w.suggestions,
        status: w.status,
        source_id: w.source_id,
        performance: w.performance,
        dubbing_project_id: w.dubbing_project_id,
        voice_actor: w.voice_actor
          ? {
              id: w.voice_actor.id,
              firstname: w.voice_actor.firstname,
              lastname: w.voice_actor.lastname,
              profile_picture: w.voice_actor.profile_picture,
              bio: w.voice_actor.bio,
              nationality: w.voice_actor.nationality,
              date_of_birth: w.voice_actor.date_of_birth,
              awards: w.voice_actor.awards,
              years_active: w.voice_actor.years_active,
              social_media_links: w.voice_actor.social_media_links,
              tmdb_id: w.voice_actor.tmdb_id,
              wikidata_id: w.voice_actor.wikidata_id,
            }
          : null,
      })) || [],
    crew:
      p.crew?.map((c: any) => ({
        id: c.id,
        name: c.name,
        job: c.job,
        department: c.department,
        profile_path: c.profile_path,
      })) || [],
  }));
}

function transformVotes(votes: Record<number, any>): Record<number, VoteData> {
  const result: Record<number, VoteData> = {};
  for (const [key, value] of Object.entries(votes)) {
    result[Number(key)] = {
      up_count: value.up_count ?? 0,
      down_count: value.down_count ?? 0,
      user_vote: value.user_vote ?? null,
    };
  }
  return result;
}

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { id } = await getParams(req);

      if (!id) {
        return Response.json(
          { error: "Missing id parameter" },
          { status: 400 },
        );
      }

      const gameId = parseInt(String(id), 10);
      if (isNaN(gameId)) {
        return Response.json(
          { error: "Invalid id parameter" },
          { status: 400 },
        );
      }

      const dbClient = new DatabaseClient(ctx);

      // Fetch IGDB game data and DB dubbing projects concurrently
      const [apiData, dbData] = await Promise.all([
        // External: IGDB game details + characters
        (async () => {
          try {
            const [game, characters] = await Promise.all([
              igdbClient.getGame(gameId),
              igdbClient.getGameCharacters(gameId),
            ]);
            return {
              game: game ? transformGameToMedia(game) : null,
              characters: characters.map((c: IgdbCharacter) => ({
                id: c.id,
                name: c.name,
                mug_shot: c.mug_shot
                  ? {
                      image_id: c.mug_shot.image_id,
                      url: buildIgdbImageUrl(c.mug_shot.image_id, "1080p"),
                    }
                  : null,
              })),
            };
          } catch (err) {
            console.error(`Failed to fetch IGDB game ${gameId}:`, err);
            return {
              game: {
                id: gameId,
                title: "Information indisponible (Timeout)",
                overview: "Ce contenu n'a pas pu être chargé.",
                poster_path: null,
                backdrop_path: null,
                vote_average: 0,
                vote_count: 0,
                genres: [],
                credits: { cast: [] },
                external_ids: { imdb_id: null, wikidata_id: null },
                media_type: "video_game" as const,
                first_release_date: null,
                summary: "",
                cover: null,
                platforms: [],
                involved_companies: [],
                characters: [],
              },
              characters: [],
            };
          }
        })(),

        // DB: dubbing projects + votes
        dbClient
          .getDubbingProjects(gameId, "video_game")
          .then(async (dubbingProjects) => {
            const workIds = dubbingProjects.flatMap(
              (p: any) => p.works?.map((w: any) => w.id) || [],
            );

            let voteData: Record<
              number,
              { up_count: number; down_count: number; user_vote: string | null }
            > = {};

            if (workIds.length > 0) {
              try {
                const user = ctx.userClaims;
                voteData = user
                  ? await dbClient.getWorkVotes(workIds, user.id)
                  : await dbClient.getWorkVotes(workIds);
              } catch (voteError) {
                console.error("Error fetching vote data:", voteError);
              }
            }

            return { dubbingProjects, voteData };
          }),
      ]);

      const { game, characters } = apiData;
      const { dubbingProjects, voteData } = dbData;

      // Lazy enqueue if not yet processed (mirrors movie.ts pattern)
      const isProcessed = dubbingProjects.length > 0;
      if (!isProcessed) {
        void (async () => {
          try {
            await ctx.supabaseAdmin.rpc("enqueue_media_fetch", {
              p_media_type: "video_game",
              p_tmdb_id: gameId, // re-uses the p_tmdb_id column for igdb_id
              p_season_number: undefined,
              p_episode_number: undefined,
            });
          } catch (err) {
            console.error("Failed to lazily enqueue video_game:", err);
          }
        })();
      }

      // Transform to new lean types
      const media = game!;
      const transformedProjects = transformDubbingProjects(
        dubbingProjects,
        ctx,
      );
      const transformedVotes = transformVotes(voteData);
      const transformedCharacters = characters || [];

      const result: GameDetailResponse = {
        media,
        dubbingProjects: transformedProjects,
        votes: transformedVotes,
        characterProfilePictures: [], // Games don't have TMDB character profile pictures
        characters: transformedCharacters,
      };

      return Response.json(result);
    } catch (error) {
      console.error("Error in game function:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
        },
        { status: 500 },
      );
    }
  }),
};
