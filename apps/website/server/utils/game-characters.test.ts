import { afterEach, describe, expect, it, vi } from "vitest";
import type { IgdbCharacter } from "@app/shared-logic";
import { loadGameCharacterCatalog, mergeGameCharacters } from "./game-characters";

const databaseMocks = vi.hoisted(() => ({ useSupabaseAdmin: vi.fn() }));

vi.mock("./db/client", () => ({
  useSupabaseAdmin: databaseMocks.useSupabaseAdmin,
}));

afterEach(() => vi.clearAllMocks());

const localCharacter = {
  id: "11111111-1111-4111-8111-111111111111",
  igdb_game_id: 42,
  name: "Local spelling",
  igdb_character_id: 7,
  wikidata_qid: "Q123",
};

describe("mergeGameCharacters", () => {
  it("merges only explicit same-game identity links and keeps local homonyms separate", () => {
    const igdbCharacters: IgdbCharacter[] = [
      { id: 7, name: "Provider spelling", games: [42] },
      { id: 8, name: "Local spelling", games: [42] },
    ];
    const localCharacters = [
      localCharacter,
      {
        ...localCharacter,
        id: "22222222-2222-4222-8222-222222222222",
        igdb_character_id: null,
      },
    ];

    const result = mergeGameCharacters(igdbCharacters, localCharacters);

    expect(result).toHaveLength(3);
    expect(
      result.find((character) => character.game_character_id === localCharacter.id),
    ).toMatchObject({
      id: 7,
      name: "Provider spelling",
      local_name: "Local spelling",
      wikidata_qid: "Q123",
      stable_id: `game_character:${localCharacter.id}`,
    });
    expect(result.map((character) => character.stable_id)).toContain("igdb_character:8");
    expect(result.map((character) => character.stable_id)).toContain(
      "game_character:22222222-2222-4222-8222-222222222222",
    );
    expect(
      result.find(
        (character) => character.game_character_id === "22222222-2222-4222-8222-222222222222",
      )?.igdb_candidate_ids,
    ).toEqual([8]);
  });
});

describe("loadGameCharacterCatalog", () => {
  it("retains local characters and reports provider failure without returning partial IGDB data", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: [localCharacter], error: null }).then(resolve),
    };
    databaseMocks.useSupabaseAdmin.mockReturnValue({ from: () => builder });

    const catalog = await loadGameCharacterCatalog(undefined, 42, async () => {
      throw new Error("provider unavailable");
    });

    expect(catalog).toMatchObject({
      providerStatus: "unavailable",
      localStatus: "available",
      characters: [
        {
          id: null,
          name: "Local spelling",
          game_character_id: localCharacter.id,
          igdb_character_id: 7,
        },
      ],
    });
  });

  it("keeps an available empty provider result distinct from provider failure", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    databaseMocks.useSupabaseAdmin.mockReturnValue({ from: () => builder });

    const catalog = await loadGameCharacterCatalog(undefined, 42, async () => []);

    expect(catalog).toMatchObject({
      providerStatus: "available",
      localStatus: "available",
      characters: [],
    });
  });
});
