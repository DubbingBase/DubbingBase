import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { TMDBClient } from "../_shared/tmdb.ts";
import { DatabaseClient } from "../_shared/database.ts";
import { MediaService } from "../_shared/media-service.ts";
import { cacheUtils, getParams } from "../_shared/index.ts";
import { processMedia } from "../_shared/tmdb-urls.ts";
import { Database } from "../_shared/database.types.ts";
import type {
  EpisodeMedia,
  EpisodeDetailResponse,
  DubbingProject,
  WorkPerformance,
  VoiceActorSummary,
  CharacterProfilePicture,
  VoteData,
  Cast,
  Genre,
} from "../_shared/media-types.ts";

// Transform TMDB episode to lean EpisodeMedia
function transformEpisodeToMedia(episode: any): EpisodeMedia {
  const processed = processMedia(episode);
  return {
    id: processed.id,
    title: processed.name,
    overview: processed.overview,
    poster_path: processed.still_path,
    backdrop_path: processed.still_path,
    vote_average: processed.vote_average,
    vote_count: processed.vote_count,
    genres:
      processed.genres?.map((g: Genre) => ({ id: g.id, name: g.name })) || [],
    credits: {
      cast:
        processed.guest_stars?.map((g: any) => ({
          id: g.id,
          name: g.name,
          character: g.character,
          profile_path: g.profile_path,
        })) || [],
    },
    external_ids: processed.external_ids || {
      imdb_id: null,
      wikidata_id: null,
    },
    media_type: "tv",
    first_air_date: processed.air_date,
    seasons: [],
    status: "",
    aggregateCredits: null,
    episode_number: processed.episode_number,
    season_number: processed.season_number,
    still_path: processed.still_path,
    air_date: processed.air_date,
    runtime: processed.runtime ?? null,
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
      const { id, season_number, episode_number } = await getParams(req);

      if (!id || season_number === undefined || episode_number === undefined) {
        return Response.json(
          { error: "Missing id, season_number or episode_number" },
          { status: 400 },
        );
      }

      const showId = parseInt(id, 10);
      const seasonNum = parseInt(season_number, 10);
      const episodeNum = parseInt(episode_number, 10);

      if (isNaN(showId) || isNaN(seasonNum) || isNaN(episodeNum)) {
        return Response.json(
          { error: "Invalid id, season_number or episode_number parameter" },
          { status: 400 },
        );
      }

      console.log("Fetching episode:", {
        id: showId,
        season_number: seasonNum,
        episode_number: episodeNum,
      });

      const tmdbClient = new TMDBClient(cacheUtils);
      const databaseClient = new DatabaseClient(ctx);
      const acceptLanguage = req.headers.get("Accept-Language") || undefined;
      const mediaService = new MediaService(
        databaseClient,
        tmdbClient,
        ctx,
        acceptLanguage,
      );

      const apiDataPromise = mediaService
        .getMediaWithVoiceActorsExtended(
          "episode",
          showId,
          seasonNum,
          episodeNum,
        )
        .then(async (result) => {
          const characterProfilePictures =
            await mediaService.getCharacterProfilePictures(
              "tv",
              showId,
              result.media,
            );
          return { episode: result.media, characterProfilePictures };
        });

      const dbDataPromise = databaseClient
        .getDubbingProjects(showId, "tv")
        .then(async (dubbingProjects) => {
          const workIds = dubbingProjects.flatMap(
            (p: any) => p.works?.map((w: any) => w.id) || [],
          );
          let voteData = {};
          if (workIds.length > 0) {
            try {
              const user = ctx.userClaims;
              if (user) {
                voteData = await databaseClient.getWorkVotes(workIds, user.id);
              } else {
                voteData = await databaseClient.getWorkVotes(workIds);
              }
            } catch (voteError) {
              console.error("Error fetching vote data:", voteError);
            }
          }
          return { dubbingProjects, voteData };
        });

      const [apiData, dbData] = await Promise.all([
        apiDataPromise,
        dbDataPromise,
      ]);

      // Transform to new lean types
      const media = transformEpisodeToMedia(apiData.episode);
      const transformedProjects = transformDubbingProjects(
        dbData.dubbingProjects,
        ctx,
      );
      const transformedVotes = transformVotes(dbData.voteData);
      const transformedCharacterPictures: CharacterProfilePicture[] =
        apiData.characterProfilePictures?.map((cp: any) => ({
          id: cp.id,
          name: cp.name,
          image: cp.image,
          tvdbPeopleId: cp.tvdbPeopleId,
          seriesId: cp.showId,
        })) || [];

      const result: EpisodeDetailResponse = {
        media,
        dubbingProjects: transformedProjects,
        votes: transformedVotes,
        characterProfilePictures: transformedCharacterPictures,
      };

      return Response.json(result);
    } catch (error) {
      console.error("Error fetching episode:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch episode data",
        },
        { status: 500 },
      );
    }
  }),
};
