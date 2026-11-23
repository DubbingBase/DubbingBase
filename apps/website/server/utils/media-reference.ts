import type { H3Event } from "h3";
import { eqMediaRef, isRecord, MEDIA_FILTER_EMBED } from "@app/shared-logic";
import type { DubbingProjectMediaType } from "../../src/utils/dubbing-project-save";
import { useIgdbClient, useOpenLibraryClient, usePodcastClient, useTmdbClient } from "./index";
import { useSupabaseAdmin } from "./db/client";

/** What a credit points at; each provider confirms the media (and actor or character) exists. */
export interface MediaReference {
  media_type: DubbingProjectMediaType;
  media_id: number;
  actor_id: number | null;
  game_character_id: string | null;
}

function mediaReferenceError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
}

function providerError(error: unknown, provider: string) {
  const missing = error instanceof Error && /(?:404|not found)/i.test(error.message);
  throw mediaReferenceError(
    missing ? 422 : 503,
    missing
      ? `The selected media does not exist in ${provider}`
      : `${provider} could not verify this link; try again`,
  );
}

export async function validateMediaReference(event: H3Event, body: MediaReference) {
  if (body.media_type === "movie" || body.media_type === "tv") {
    let media: unknown;
    try {
      media = await useTmdbClient().fetchMediaDetails(body.media_id, body.media_type);
    } catch (error) {
      providerError(error, "TMDB");
    }
    if (!isRecord(media) || media.id !== body.media_id) {
      throw mediaReferenceError(422, "The selected media does not exist in TMDB");
    }
    if (body.actor_id !== null) {
      const credits = media.credits;
      const cast = isRecord(credits) ? credits.cast : null;
      if (
        !Array.isArray(cast) ||
        !cast.some((person: unknown) => isRecord(person) && person.id === body.actor_id)
      ) {
        throw mediaReferenceError(422, "The selected actor does not belong to this media");
      }
    }
    return;
  }

  if (body.media_type === "video_game") {
    if (body.game_character_id) {
      const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
      const { data, error } = await eqMediaRef(
        supabase
          .from("game_characters")
          .select(`id, ${MEDIA_FILTER_EMBED}`)
          .eq("id", body.game_character_id),
        "video_game",
        body.media_id,
      ).maybeSingle();
      if (error) throw mediaReferenceError(500, "Local game character could not be verified");
      if (!data) throw mediaReferenceError(422, "The selected character does not belong to this game");
      return;
    }
    const igdb = useIgdbClient();
    let game: Awaited<ReturnType<typeof igdb.getGame>> | undefined;
    try {
      game = await igdb.getGame(body.media_id);
    } catch (error) {
      providerError(error, "IGDB");
    }
    if (!game || game.id !== body.media_id) {
      throw mediaReferenceError(422, "The selected game does not exist in IGDB");
    }
    if (body.actor_id !== null) {
      try {
        const characters = await igdb.getGameCharacters(body.media_id);
        if (!characters.some((character) => character.id === body.actor_id)) {
          throw mediaReferenceError(422, "The selected character does not belong to this game");
        }
      } catch (error) {
        if (error && typeof error === "object" && "statusCode" in error) {
          throw error;
        }
        providerError(error, "IGDB");
      }
    }
    return;
  }

  if (body.media_type === "audiobook") {
    let book: Awaited<ReturnType<ReturnType<typeof useOpenLibraryClient>["getBook"]>> | undefined;
    try {
      book = await useOpenLibraryClient().getBook(body.media_id);
    } catch (error) {
      providerError(error, "Open Library");
    }
    if (!book || book.id !== body.media_id) {
      throw mediaReferenceError(422, "The selected audiobook does not exist in Open Library");
    }
    return;
  }

  if (body.media_type === "podcast") {
    let podcast: Awaited<ReturnType<ReturnType<typeof usePodcastClient>["getPodcast"]>> | undefined;
    try {
      podcast = await usePodcastClient().getPodcast(body.media_id);
    } catch (error) {
      providerError(error, "iTunes");
    }
    if (!podcast || podcast.id !== body.media_id || podcast.title === `Podcast #${body.media_id}`) {
      throw mediaReferenceError(422, "The selected podcast does not exist in iTunes");
    }
    return;
  }

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data, error } = await eqMediaRef(
    supabase.from("dubbing_projects").select(`id, ${MEDIA_FILTER_EMBED}`),
    body.media_type,
    body.media_id,
  )
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Failed to verify internal media reference", {
      code: error.code,
    });
    throw mediaReferenceError(500, "The selected internal media could not be verified");
  }
  if (!data) {
    throw mediaReferenceError(422, "The selected internal media does not exist");
  }
}
