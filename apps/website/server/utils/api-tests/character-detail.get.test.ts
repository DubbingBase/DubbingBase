import { createApp, createError, defineEventHandler, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  useSupabaseAdmin: vi.fn(),
  getCharacterById: vi.fn(),
  getMediaWithVoiceActors: vi.fn(),
  getCharacterProfilePictures: vi.fn(),
  getDubbingProjects: vi.fn(),
  getGamePageDubbingProjects: vi.fn(),
  loadGameCharacterCatalog: vi.fn(),
  source: String("tvdb"),
  id: String("77"),
  query: { mediaType: "movie", mediaId: "456" },
}));

vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));
vi.mock("../..", () => ({
  useTmdbClient: () => ({}),
  useTvdbClient: () => ({ getCharacterById: routeMocks.getCharacterById }),
  useIgdbClient: () => ({ getGameCharacters: vi.fn() }),
}));
vi.mock("../services/media", () => ({
  MediaService: class {
    getMediaWithVoiceActors(...args: unknown[]) {
      return routeMocks.getMediaWithVoiceActors(...args);
    }
    getCharacterProfilePictures(...args: unknown[]) {
      return routeMocks.getCharacterProfilePictures(...args);
    }
  },
}));
vi.mock("../db/queries", () => ({
  getDubbingProjects: routeMocks.getDubbingProjects,
  getGamePageDubbingProjects: routeMocks.getGamePageDubbingProjects,
}));
vi.mock("../game-characters", () => ({
  loadGameCharacterCatalog: routeMocks.loadGameCharacterCatalog,
}));

let handler: typeof import("../../api/character/[source]/[id].get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getHeader", () => undefined);
  vi.stubGlobal("getQuery", () => routeMocks.query);
  vi.stubGlobal("getRouterParam", (_event: unknown, key: string) =>
    key === "source" ? routeMocks.source : routeMocks.id,
  );
  handler = (await import("../../api/character/[source]/[id].get")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.source = "tvdb";
  routeMocks.id = "77";
  routeMocks.query = { mediaType: "movie", mediaId: "456" };
  routeMocks.useSupabaseAdmin.mockReturnValue({});
  routeMocks.getMediaWithVoiceActors.mockResolvedValue({
    media: {
      title: "Batman",
      credits: { cast: [{ id: 123, name: "Original performer", character: "Joker" }] },
    },
  });
  routeMocks.getCharacterProfilePictures.mockResolvedValue({
    characters: [{ id: 77, name: "Joker", image: "https://example.com/joker.jpg" }],
  });
  routeMocks.getCharacterById.mockResolvedValue({
    data: { name: "Joker", image: "https://example.com/joker.jpg", overview: "Role description" },
  });
  routeMocks.getDubbingProjects.mockResolvedValue([
    {
      id: 9,
      language: "fr-FR",
      studio_data: { name: "Studio" },
      works: [
        {
          id: 20,
          character_name: "Joker",
          actor_id: 123,
          performance: "Laughs",
          note: "Film scope",
          voice_actor: { id: 10, firstname: "Jean", lastname: "Test", profile_picture: null },
        },
        { id: 21, character_name: "Robin", actor_id: 124, voice_actor: null },
      ],
    },
  ]);
});

afterAll(() => vi.unstubAllGlobals());

describe("GET /api/character/:source/:id", () => {
  it("verifies the TVDB role in its production and returns only that role's credits", async () => {
    const app = createApp();
    app.use("/tvdb/77", handler);
    const response = await toWebHandler(app)(new Request("http://localhost/tvdb/77"));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.getCharacterProfilePictures).toHaveBeenCalledWith(
      "movie",
      456,
      expect.any(Function),
    );
    expect(routeMocks.getDubbingProjects).toHaveBeenCalledWith(456, "movie");
    expect(body).toMatchObject({
      source: "tvdb",
      id: 77,
      name: "Joker",
      appearances: [
        {
          project: { id: 456, content_id: 456, content_type: "movie", title: "Batman" },
          originalPerformers: [{ id: 123, name: "Original performer" }],
          credits: [
            {
              id: 20,
              language: "fr-FR",
              studio: "Studio",
              performance: "Laughs",
              note: "Film scope",
            },
          ],
        },
      ],
    });
  });

  it("does not attach ambiguous same-name roles' credits to one TVDB identity", async () => {
    routeMocks.getCharacterProfilePictures.mockResolvedValue({
      characters: [
        { id: 77, name: "Joker", image: null },
        { id: 88, name: "Joker", image: null },
      ],
    });

    const app = createApp();
    app.use("/tvdb/77", handler);
    const response = await toWebHandler(app)(new Request("http://localhost/tvdb/77"));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.getDubbingProjects).not.toHaveBeenCalled();
    expect(body).toMatchObject({ appearances: [{ credits: [] }] });
  });

  it("preserves local, linked IGDB, and legacy game credits within the local game record", async () => {
    const gameCharacterId = "11111111-1111-4111-8111-111111111111";
    routeMocks.source = "game";
    routeMocks.id = gameCharacterId;
    routeMocks.useSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: gameCharacterId,
            igdb_game_id: 456,
            name: "Custom hero",
            igdb_character_id: 77,
          },
          error: null,
        }),
      })),
    });
    routeMocks.loadGameCharacterCatalog.mockResolvedValue({
      characters: [
        {
          id: 77,
          name: "IGDB hero",
          games: [456],
          mug_shot: undefined,
          stable_id: `game_character:${gameCharacterId}`,
          game_character_id: gameCharacterId,
          igdb_character_id: 77,
          wikidata_qid: null,
          identity_source: "local",
          local_name: "Custom hero",
          local_updated_at: null,
          igdb_candidate_ids: [],
        },
      ],
      providerStatus: "available",
      localStatus: "available",
    });
    routeMocks.getGamePageDubbingProjects.mockResolvedValue([
      {
        id: 9,
        language: "fr-FR",
        studio_data: { id: 3, name: "Studio" },
        works: [
          {
            id: 20,
            game_character_id: gameCharacterId,
            character_id: null,
            actor_id: null,
            character_name: "Custom hero",
            performance: "Line",
            note: "Local UUID",
            voice_actor: { id: 10, firstname: "Jean", lastname: "Test", profile_picture: null },
          },
          {
            id: 21,
            game_character_id: null,
            character_id: 77,
            actor_id: null,
            character_name: "IGDB link",
            performance: "Linked",
            note: null,
            voice_actor: { id: 11, firstname: "A", lastname: "B", profile_picture: null },
          },
          {
            id: 22,
            game_character_id: null,
            character_id: 9000000077,
            actor_id: null,
            character_name: "Legacy ID",
            performance: null,
            note: "Legacy",
            voice_actor: { id: 12, firstname: "C", lastname: "D", profile_picture: null },
          },
          {
            id: 23,
            game_character_id: null,
            character_id: 5,
            actor_id: null,
            character_name: "Unrelated",
            performance: null,
            note: null,
            voice_actor: { id: 13, firstname: "E", lastname: "F", profile_picture: null },
          },
        ],
      },
    ]);

    const app = createApp();
    app.use("/game/local", handler);
    const response = await toWebHandler(app)(new Request("http://localhost/game/local"));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      source: "game",
      id: gameCharacterId,
      name: "Custom hero",
      igdbCharacterId: 77,
      appearances: [
        { credits: [{ id: 20, performance: "Line", note: "Local UUID" }] },
        { credits: [{ id: 21, performance: "Linked" }] },
        { credits: [{ id: 22, note: "Legacy" }] },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('"id":23');
  });
});
