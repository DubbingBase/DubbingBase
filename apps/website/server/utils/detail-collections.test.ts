import { createApp, createError, defineEventHandler, getQuery, toWebHandler } from "h3";
import { effectScope } from "vue";
import {
  useActorData,
  filterDetailCollectionItems,
  formatGameDetailCastCards,
  formatMediaWorkCastCards,
  paginateDetailCollection,
  selectDetailCollectionProject,
  type ActorDataPayload,
  type PaginatedResponse,
} from "@app/shared-logic";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let handler: typeof import("../api/detail-collections.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  handler = (await import("../api/detail-collections.get")).default;
});

afterAll(() => vi.unstubAllGlobals());

async function requestCollection(
  query: URLSearchParams,
  fetchData: (path: string) => Promise<Record<string, unknown>>,
): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      Object.defineProperty(event, "$fetch", { value: fetchData });
      return handler(event);
    }),
  );

  return await toWebHandler(app)(new Request(`http://localhost/?${query.toString()}`));
}

const actorPayload: ActorDataPayload = {
  actor: {
    id: 42,
    name: "Sample Actor",
    biography: "",
    birthday: null,
    deathday: null,
    place_of_birth: null,
    profile_path: null,
    known_for_department: "Acting",
    credits: {
      cast: [
        {
          id: 1,
          title: "Guide",
          character: "Lead",
          poster_path: null,
          media_type: "movie",
        },
        {
          id: 2,
          title: "Other Work",
          name: "Guide Original",
          character: "Jane Doe",
          poster_path: null,
          media_type: "tv",
        },
        {
          id: 3,
          title: "Guide Returns",
          character: "Support",
          poster_path: null,
          media_type: "movie",
        },
      ],
    },
    voice_roles: [
      {
        id: 101,
        performance: "Lead",
        voice_actors: [
          {
            id: 10,
            firstname: "Jane",
            lastname: "Doe",
            profile_picture: null,
          },
        ],
        mediaDetails: {
          id: 1,
          title: "Guide",
          original_title: "Guide",
          poster_path: null,
          release_date: "2000-01-01",
          media_type: "movie",
          overview: "",
        },
        dubbing_projects: { language: "fr-FR" },
      },
      {
        id: 102,
        performance: "Lead",
        voice_actors: [
          {
            id: 10,
            firstname: "Jane",
            lastname: "Doe",
            profile_picture: null,
          },
        ],
        mediaDetails: {
          id: 2,
          title: "Other Work",
          original_title: "Other Work",
          poster_path: null,
          release_date: "2001-01-01",
          media_type: "tv",
          overview: "",
        },
        dubbing_projects: { language: "en-US" },
      },
      {
        id: 103,
        performance: "Support",
        voice_actors: [
          {
            id: 11,
            firstname: "John",
            lastname: "Smith",
            profile_picture: null,
          },
        ],
        mediaDetails: {
          id: 3,
          title: "Guide Returns",
          original_title: "Guide Returns",
          poster_path: null,
          release_date: "2002-01-01",
          media_type: "movie",
          overview: "",
        },
        dubbing_projects: { language: "fr-FR" },
      },
    ],
  },
  voiceRoles: [],
};
actorPayload.voiceRoles = actorPayload.actor?.voice_roles || [];

describe("GET /api/detail-collections", () => {
  it("keeps generic pagination for other collection types", async () => {
    const projects = Array.from({ length: 13 }, (_, index) => ({
      id: index + 1,
      title: `Project ${index + 1}`,
    }));
    const fetchData = async () => ({ dubbedProjects: projects });
    const response = await requestCollection(
      new URLSearchParams({
        collection: "studio-projects",
        id: "studio-1",
        page: "1",
        pageSize: "12",
      }),
      fetchData,
    );
    const body: PaginatedResponse<{ id: number; title: string }> = await response.json();

    expect(body.data).toHaveLength(12);
    expect(body.pagination).toMatchObject({
      page: 1,
      pageSize: 12,
      totalItems: 13,
      totalPages: 2,
    });
  });

  it.each(["audiobook", "podcast", "advertisement", "toy"])(
    "keeps %s cast projections identical for project selection, search, and pagination",
    async (type) => {
      const projects = [
        {
          id: 1,
          works: [
            {
              id: 101,
              character_name: "Mika",
              voice_actor: { id: 10, firstname: "Mika", lastname: "Sato" },
            },
          ],
        },
        {
          id: 2,
          works: [
            {
              id: 201,
              character_name: "Hana",
              voice_actor: { id: 11, firstname: "Mika", lastname: "Sato" },
            },
            {
              id: 202,
              character_name: "Mika's Echo",
              voice_actor: { id: 12, firstname: "Kei", lastname: "Ito" },
            },
            {
              id: 203,
              character_name: "Other",
              voice_actor: { id: 13, firstname: "Ren", lastname: "Aki" },
            },
          ],
        },
      ];
      const project = selectDetailCollectionProject(projects, "2");
      const expected = paginateDetailCollection(
        filterDetailCollectionItems(formatMediaWorkCastCards(project), "Mika"),
        2,
        1,
      );
      const paths: string[] = [];
      const response = await requestCollection(
        new URLSearchParams({
          collection: "media-cast",
          type,
          id: "77",
          projectId: "2",
          query: "Mika",
          page: "2",
          pageSize: "1",
        }),
        async (path) => {
          paths.push(path);
          return { dubbingProjects: projects };
        },
      );
      const body: PaginatedResponse<{ work_id: number }> = await response.json();

      expect(paths).toEqual([`/api/${type}/77`]);
      expect(body.pagination).toMatchObject({
        page: 2,
        pageSize: 1,
        totalItems: 2,
        totalPages: 2,
      });
      expect(body.data).toEqual(expected);
      expect(body.data[0]?.work_id).toBe(202);
    },
  );

  it("keeps game cast projections identical across character matching and unmatched works", async () => {
    const characters = [
      { id: 1, name: "Cedar" },
      { id: 2, name: "Orchid" },
    ];
    const projects = [
      {
        id: 7,
        works: [
          {
            id: 301,
            character_id: 1,
            character_name: "Cedar",
            voice_actor: { id: 10, firstname: "Rin", lastname: "Mori" },
          },
          {
            id: 302,
            character_id: 2,
            character_name: "Orchid",
            voice_actor: { id: 11, firstname: "Yui", lastname: "Abe" },
          },
          {
            id: 303,
            character_id: 99,
            character_name: "Rin's Shadow",
            voice_actor: { id: 12, firstname: "Nao", lastname: "Ito" },
          },
        ],
      },
    ];
    const project = selectDetailCollectionProject(projects, 7);
    const expected = paginateDetailCollection(
      filterDetailCollectionItems(formatGameDetailCastCards(characters, project), "Rin"),
      2,
      1,
    );
    const paths: string[] = [];
    const response = await requestCollection(
      new URLSearchParams({
        collection: "media-cast",
        type: "game",
        id: "88",
        projectId: "7",
        query: "Rin",
        page: "2",
        pageSize: "1",
      }),
      async (path) => {
        paths.push(path);
        return { characters, dubbingProjects: projects };
      },
    );
    const body: PaginatedResponse<{ id: string; name: string }> = await response.json();

    expect(paths).toEqual(["/api/game/88"]);
    expect(body.pagination.totalItems).toBe(2);
    expect(body.data).toEqual(expected);
    expect(body.data[0]?.name).toBe("Rin's Shadow");
  });

  it("keeps studio project and roster filtering and pagination aligned with page projections", async () => {
    const projects = Array.from({ length: 16 }, (_, index) => ({
      id: index + 1,
      title: `Project ${index + 1}`,
      media: { title: index === 2 || index === 12 ? "Mika Special" : "Other" },
    }));
    const roster = Array.from({ length: 13 }, (_, index) => ({
      id: index + 1,
      firstname: `Voice ${index + 1}`,
    }));
    const filteredProjects = filterDetailCollectionItems(projects, "Mika");
    const expectedProjects = paginateDetailCollection(filteredProjects, 2, 1);
    const projectPaths: string[] = [];
    const projectsResponse = await requestCollection(
      new URLSearchParams({
        collection: "studio-projects",
        id: "studio-1",
        query: "Mika",
        page: "2",
        pageSize: "1",
      }),
      async (path) => {
        projectPaths.push(path);
        return { dubbedProjects: projects };
      },
    );
    const projectsBody: PaginatedResponse<{ id: number }> = await projectsResponse.json();

    const expectedRoster = paginateDetailCollection(roster, 2, 12);
    const rosterPaths: string[] = [];
    const rosterResponse = await requestCollection(
      new URLSearchParams({
        collection: "studio-voice-actors",
        id: "studio-1",
        page: "2",
        pageSize: "12",
      }),
      async (path) => {
        rosterPaths.push(path);
        return { voiceActorsRoster: roster };
      },
    );
    const rosterBody: PaginatedResponse<{ id: number }> = await rosterResponse.json();

    expect(projectPaths).toEqual(["/api/get-studio-details"]);
    expect(projectsBody.pagination.totalItems).toBe(2);
    expect(projectsBody.data).toEqual(expectedProjects);
    expect(rosterPaths).toEqual(["/api/get-studio-details"]);
    expect(rosterBody.pagination.totalItems).toBe(13);
    expect(rosterBody.data).toEqual(expectedRoster);
  });

  it("preserves actor collection filtering and pagination for standalone callers", async () => {
    const scope = effectScope();
    const actorData = scope.run(() => useActorData(actorPayload));
    if (!actorData) throw new Error("Actor data scope was not created");

    try {
      actorData.selectedLanguage.value = "fr-FR";
      actorData.searchQuery.value = " Guide ";
      expect(actorData.enhancedFilmography.value.map((item) => item.id)).toEqual([1, 2, 3]);

      const fetchActor = async (): Promise<Record<string, unknown>> => ({
        actor: actorPayload.actor,
      });
      const filmographyResponse = await requestCollection(
        new URLSearchParams({
          collection: "actor-filmography",
          id: "42",
          language: "fr-FR",
          query: " Guide ",
          page: "3",
          pageSize: "1",
        }),
        fetchActor,
      );
      const filmographyBody: PaginatedResponse<{
        id: number;
        voice_actors: Array<{ id: number }>;
      }> = await filmographyResponse.json();

      expect(filmographyBody.pagination).toMatchObject({
        page: 3,
        pageSize: 1,
        totalItems: 3,
        totalPages: 3,
      });
      expect(filmographyBody.data).toEqual([
        {
          id: 3,
          voice_actors: [
            {
              id: 11,
              firstname: "John",
              lastname: "Smith",
              profile_picture: null,
            },
          ],
          title: "Guide Returns",
          character: "Support",
          poster_path: null,
          media_type: "movie",
        },
      ]);
      expect(actorData.enhancedFilmography.value[2]?.voice_actors).toEqual(
        filmographyBody.data[0]?.voice_actors,
      );

      actorData.searchQuery.value = "Original";
      const originalTitleResponse = await requestCollection(
        new URLSearchParams({
          collection: "actor-filmography",
          id: "42",
          language: "fr-FR",
          query: "Original",
        }),
        fetchActor,
      );
      const originalTitleBody: PaginatedResponse<{ id: number }> =
        await originalTitleResponse.json();
      expect(actorData.enhancedFilmography.value.map((item) => item.id)).toEqual([2]);
      expect(originalTitleBody.data.map((item) => item.id)).toEqual([2]);

      actorData.searchQuery.value = "Doe";
      const voiceActorsResponse = await requestCollection(
        new URLSearchParams({
          collection: "actor-voice-actors",
          id: "42",
          language: "fr-FR",
          query: "Doe",
          page: "1",
          pageSize: "1",
        }),
        fetchActor,
      );
      const voiceActorsBody: PaginatedResponse<{
        id: number;
        firstname: string;
        lastname: string;
        rolesCount: number;
      }> = await voiceActorsResponse.json();

      expect(voiceActorsBody.pagination.totalItems).toBe(1);
      expect(actorData.filteredUniqueVoiceActorsByLanguage.value).toEqual(voiceActorsBody.data);

      actorData.searchQuery.value = "Jane Doe";
      expect(actorData.filteredUniqueVoiceActorsByLanguage.value).toEqual([]);
    } finally {
      scope.stop();
    }
  });
});
