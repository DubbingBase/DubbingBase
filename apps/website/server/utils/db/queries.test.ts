import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
  useSupabaseAdmin: vi.fn(),
  selectedColumns: new Array<string>(),
}));

vi.mock("./client", () => ({
  useSupabaseAdmin: queryMocks.useSupabaseAdmin,
}));

import {
  getDubbingProjects,
  getDubbingProjectsForMediaEndpoint,
  getMediaPageDubbingProjects,
  getGamePageDubbingProjects,
  getToyPageDubbingProjects,
} from "./queries";

function createSupabaseMock(rows: unknown[]) {
  const result = { data: rows, error: null };
  const builder = {
    select(columns: string) {
      queryMocks.selectedColumns.push(columns);
      return builder;
    },
    eq() {
      return builder;
    },
    then(resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };

  return {
    from: vi.fn(() => builder),
  };
}

describe("dubbing project detail queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.selectedColumns.length = 0;
  });

  it("uses a compact projection for media pages while preserving cast and studio data", async () => {
    const rows = [
      {
        id: 17,
        language: "fr-FR",
        studio_data: {
          id: 3,
          name: "Studio",
          logo_url: "https://example.com/studio.png",
        },
        works: [
          {
            id: 12,
            actor_id: 44,
            character_name: "Character",
            performance: "Role",
            note: "Note",
            voice_actor: {
              id: 5,
              firstname: "Voice",
              lastname: "Actor",
              profile_picture: "https://example.com/voice-actor.png",
              voice_actor_name: "Voice Actor",
            },
          },
        ],
      },
    ];
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock(rows));

    const projects = await getMediaPageDubbingProjects(1, "tv");

    expect(projects).toEqual([
      {
        ...rows[0],
        crew: [],
      },
    ]);
    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios");
    expect(projects[0]?.studio_data).toMatchObject({
      id: 3,
      name: "Studio",
      logo_url: "https://example.com/studio.png",
    });
    expect(projects[0]?.works[0]?.voice_actor).toMatchObject({
      id: 5,
      voice_actor_name: "Voice Actor",
      profile_picture: "https://example.com/voice-actor.png",
    });
  });

  it("keeps the full projection available to pages that render crew", async () => {
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock([]));

    await getDubbingProjects(1, "toy");

    expect(queryMocks.selectedColumns[0]).toContain("crew:dubbing_project_crew");
    expect(queryMocks.selectedColumns[0]).toContain("person:voice_actors(*)");
  });

  it("projects podcast detail projects while retaining cast, studio, and crew data", async () => {
    const rows = [
      {
        id: 17,
        language: "fr-FR",
        studio_data: { id: 3, name: "Studio", logo_url: "https://example.com/logo.png" },
        works: [
          {
            id: 12,
            actor_id: 44,
            character_name: "Character",
            performance: "Role",
            note: "Note",
            voice_actor: {
              id: 5,
              firstname: "Voice",
              lastname: "Actor",
              profile_picture: "https://example.com/actor.png",
            },
          },
        ],
        crew: [
          {
            id: 20,
            job: { name: "Director" },
            person: { id: 5, firstname: "Voice", lastname: "Actor" },
          },
        ],
      },
    ];
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock(rows));

    const projects = await getDubbingProjectsForMediaEndpoint(1, "podcast", "podcast-page");

    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios");
    expect(queryMocks.selectedColumns[0]).toContain("crew:dubbing_project_crew");
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors");
    expect(projects).toMatchObject(rows);
  });

  it("preserves the complete public payload when no page projection is requested", async () => {
    const rows = [
      {
        id: 17,
        content_id: 1,
        content_type: "movie",
        language: "fr-FR",
        extra: "project metadata",
        studio_data: { id: 3, name: "Studio", logo_url: "https://example.com/logo.png" },
        works: [
          {
            id: 12,
            actor_id: 44,
            character_name: "Character",
            performance: "Role",
            note: "Note",
            voice_actor: {
              id: 5,
              firstname: "Voice",
              lastname: "Actor",
              profile_picture: "https://example.com/voice-actor.png",
              voice_actor_name: "Actor",
              tmdb_id: 99,
            },
          },
        ],
        crew: [
          {
            id: 20,
            person_id: 5,
            job_id: 2,
            job: { id: 2, name: "Director" },
            person: {
              id: 5,
              firstname: "Voice",
              lastname: "Actor",
              profile_picture: "https://example.com/voice-actor.png",
            },
          },
        ],
      },
    ];
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock(rows));

    const projects = await getDubbingProjectsForMediaEndpoint(1, "movie", undefined);

    expect(projects).toEqual(rows);
    expect(queryMocks.selectedColumns[0]).toContain("*,");
    expect(queryMocks.selectedColumns[0]).toContain("crew:dubbing_project_crew");
    expect(projects[0]?.crew[0]?.person).toMatchObject({
      id: 5,
      firstname: "Voice",
      profile_picture: "https://example.com/voice-actor.png",
    });
  });

  it("selects compact fields only for the explicit media-page projection", async () => {
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock([]));

    await getDubbingProjectsForMediaEndpoint(1, "movie", "media-page");

    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios");
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors");
  });

  it("selects toy page fields while retaining crew, cast, and studio data", async () => {
    const rows = [
      {
        id: 17,
        language: "fr-FR",
        studio_data: { id: 3, name: "Studio" },
        works: [
          {
            id: 12,
            actor_id: 44,
            character_name: "Character",
            performance: "Role",
            note: "Note",
            voice_actor: {
              id: 5,
              firstname: "Voice",
              lastname: "Actor",
              profile_picture: "https://example.com/voice-actor.png",
            },
          },
        ],
        crew: [
          {
            id: 20,
            job: { name: "Director" },
            person: { id: 5, firstname: "Voice", lastname: "Actor" },
          },
        ],
      },
    ];
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock(rows));

    const projects = await getToyPageDubbingProjects(31);

    expect(projects).toMatchObject(rows);
    expect(projects[0]?.crew?.[0]?.person?.profile_picture).toBeNull();
    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios(id, name)");
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors(id");
    expect(queryMocks.selectedColumns[0]).toContain("crew:dubbing_project_crew");
    expect(queryMocks.selectedColumns[0]).toContain("job:jobs(name)");
  });

  it("selects game page fields while retaining character links and studio data", async () => {
    const rows = [
      {
        id: 21,
        language: "fr-FR",
        studio_data: { id: 7, name: "Game Studio", logo_url: "https://example.com/logo.jpg" },
        works: [
          {
            id: 91,
            actor_id: 42,
            character_id: 17,
            character_name: "Character",
            voice_actor: {
              id: 42,
              firstname: "Voice",
              lastname: "Actor",
              profile_picture: "https://example.com/voice-actor.png",
            },
          },
        ],
      },
    ];
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock(rows));

    const projects = await getGamePageDubbingProjects(31);

    expect(projects).toMatchObject([{ ...rows[0], crew: [] }]);
    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios(id, name, logo_url)");
    expect(queryMocks.selectedColumns[0]).toContain("character_id");
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors(id");
    expect(projects[0]?.crew).toEqual([]);
  });

  it("returns an empty array when the requested dubbing project list is empty", async () => {
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock([]));

    await expect(getDubbingProjectsForMediaEndpoint(1, "movie", "media-page")).resolves.toEqual([]);
  });
});
