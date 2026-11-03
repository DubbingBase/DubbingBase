import type { IgdbCharacter } from "@app/shared-logic";
import type { Database } from "@app/supabase/types";
import { useSupabaseAdmin } from "./db/client";

type LocalGameCharacter = Pick<
  Database["public"]["Tables"]["game_characters"]["Row"],
  "id" | "igdb_game_id" | "name" | "igdb_character_id" | "wikidata_qid" | "updated_at"
>;

export interface ResolvedGameCharacter extends Omit<IgdbCharacter, "id"> {
  id: number | null;
  stable_id: string;
  game_character_id: string | null;
  igdb_character_id: number | null;
  wikidata_qid: string | null;
  identity_source: "igdb" | "local";
  local_name: string | null;
  local_updated_at: string | null;
  igdb_candidate_ids: number[];
}

export function mergeGameCharacters(
  igdbCharacters: readonly IgdbCharacter[],
  localCharacters: readonly LocalGameCharacter[],
): ResolvedGameCharacter[] {
  const igdbById = new Map(igdbCharacters.map((character) => [character.id, character]));
  const linkedIgdbIds = new Set(
    localCharacters.flatMap((local) =>
      local.igdb_character_id && igdbById.has(local.igdb_character_id)
        ? [local.igdb_character_id]
        : [],
    ),
  );
  const resolved: ResolvedGameCharacter[] = [];

  for (const local of localCharacters) {
    const linkedCharacter = local.igdb_character_id
      ? igdbById.get(local.igdb_character_id)
      : undefined;
    const nameKey = local.name.normalize("NFKC").trim().toLowerCase();
    const candidateIds = local.igdb_character_id
      ? []
      : igdbCharacters
          .filter(
            (character) =>
              !linkedIgdbIds.has(character.id) &&
              character.name.normalize("NFKC").trim().toLowerCase() === nameKey,
          )
          .map((character) => character.id);

    resolved.push({
      ...(linkedCharacter ?? {}),
      id: linkedCharacter?.id ?? null,
      name: linkedCharacter?.name ?? local.name,
      games: linkedCharacter?.games ?? [local.igdb_game_id],
      stable_id: `game_character:${local.id}`,
      game_character_id: local.id,
      igdb_character_id: local.igdb_character_id,
      wikidata_qid: local.wikidata_qid,
      identity_source: "local",
      local_name: local.name,
      local_updated_at: local.updated_at,
      igdb_candidate_ids: candidateIds,
    });
  }

  for (const character of igdbCharacters) {
    if (linkedIgdbIds.has(character.id)) continue;
    resolved.push({
      ...character,
      stable_id: `igdb_character:${character.id}`,
      game_character_id: null,
      igdb_character_id: character.id,
      wikidata_qid: null,
      identity_source: "igdb",
      local_name: null,
      local_updated_at: null,
      igdb_candidate_ids: [],
    });
  }

  return resolved.sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.stable_id.localeCompare(right.stable_id),
  );
}

export async function loadGameCharacterCatalog(
  event: Parameters<typeof useSupabaseAdmin>[0],
  gameId: number,
  loadIgdbCharacters: () => Promise<IgdbCharacter[]>,
) {
  let igdbCharacters: IgdbCharacter[] = [];
  let providerStatus: "available" | "unavailable" = "available";
  try {
    igdbCharacters = await loadIgdbCharacters();
  } catch (error) {
    providerStatus = "unavailable";
    console.error("Failed to load IGDB game characters", {
      gameId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  }

  let localCharacters: LocalGameCharacter[] = [];
  let localStatus: "available" | "unavailable" = "available";
  try {
    const { data, error } = await useSupabaseAdmin(event)
      .from("game_characters")
      .select("id, igdb_game_id, name, igdb_character_id, wikidata_qid, updated_at")
      .eq("igdb_game_id", gameId)
      .order("name")
      .order("id");

    if (error) throw error;
    localCharacters = data;
  } catch (error) {
    localStatus = "unavailable";
    console.error("Failed to load local game characters", {
      gameId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  }

  return {
    characters: mergeGameCharacters(igdbCharacters, localCharacters),
    providerStatus,
    localStatus,
  };
}
