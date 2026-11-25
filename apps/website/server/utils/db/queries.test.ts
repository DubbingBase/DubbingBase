import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
  useSupabaseAdmin: vi.fn(),
  selectedColumns: new Array<string>(),
  /** `.eq(column, value)` / `.in(column, values)` calls of every query, in order. */
  eqCalls: new Array<[string, unknown]>(),
  inCalls: new Array<[string, unknown]>(),
}));

vi.mock("./client", () => ({
  useSupabaseAdmin: queryMocks.useSupabaseAdmin,
}));

import {
  getDubbingProjects,
  getActorPageWorkByActor,
  getDubbingProjectsForMediaEndpoint,
  getAdvertisementPageDubbingProjects,
  getMediaPageDubbingProjectData,
  getEpisodePageDubbingProjectData,
  getGamePageDubbingProjects,
  getSeasonPageDubbingProjects,
  getToyPageDubbingProjects,
} from "./queries";

function createSupabaseMock(rows: unknown[], error: unknown = null) {
  const result = { data: rows, error };
  const builder = {
    select(columns: string) {
      queryMocks.selectedColumns.push(columns);
      return builder;
    },
    eq(column: string, value: unknown) {
      queryMocks.eqCalls.push([column, value]);
      return builder;
    },
    in(column: string, values: unknown) {
      queryMocks.inCalls.push([column, values]);
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

const MEDIA_FILTER_SELECT = "media:media_id!inner(id,kind,content_id)";

/** The select joins `media` as an inner join (a left join would silently return every project). */
function expectInnerMediaJoin() {
  expect(queryMocks.selectedColumns).toHaveLength(1);
  expect(queryMocks.selectedColumns[0]).toContain(MEDIA_FILTER_SELECT);
}

/** The media filters are applied, in this order, on the embedded `media` columns. */
function expectMediaFilter(kind: string, contentId: number) {
  expect(queryMocks.eqCalls.slice(0, 2)).toEqual([
    ["media.kind", kind],
    ["media.content_id", contentId],
  ]);
}

describe("dubbing project detail queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.selectedColumns.length = 0;
    queryMocks.eqCalls.length = 0;
    queryMocks.inCalls.length = 0;
  });

  it("deduplicates media-page voice actors and omits unused work fields", async () => {
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
          {
            id: 13,
            actor_id: 45,
            character_name: "Second Character",
            performance: "Unused role label",
            note: null,
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

    const result = await getMediaPageDubbingProjectData(1, "tv");

    expect(result).toEqual({
      dubbingProjects: [
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
              note: "Note",
              voice_actor_id: 5,
            },
            {
              id: 13,
              actor_id: 45,
              character_name: "Second Character",
              note: null,
              voice_actor_id: 5,
            },
          ],
        },
      ],
      voiceActors: [
        {
          id: 5,
          firstname: "Voice",
          lastname: "Actor",
          profile_picture: "https://example.com/voice-actor.png",
        },
      ],
    });
    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios");
    expect(queryMocks.selectedColumns[0]).not.toContain("performance");
    expect(queryMocks.selectedColumns[0]).not.toContain("voice_actor_name");
    expectInnerMediaJoin();
    expectMediaFilter("tv", 1);
  });

  it("returns project summaries and selected episode works with unique voice actors", async () => {
    queryMocks.useSupabaseAdmin.mockReturnValue(
      createSupabaseMock([
        {
          id: 17,
          language: "fr-FR",
          studio_data: { id: 3, name: "Studio", logo_url: null },
          works: [
            {
              id: 12,
              actor_id: 44,
              character_name: "Character",
              note: "First note",
              voice_actor: {
                id: 5,
                firstname: "Voice",
                lastname: "Actor",
                profile_picture: "voice-actor.png",
                voice_actor_name: "Unused name",
              },
            },
            {
              id: 13,
              actor_id: 45,
              character_name: "Second character",
              note: null,
              voice_actor: {
                id: 5,
                firstname: "Voice",
                lastname: "Actor",
                profile_picture: "voice-actor.png",
                voice_actor_name: "Unused name",
              },
            },
            {
              id: 14,
              actor_id: null,
              character_name: "Unassigned",
              note: null,
              voice_actor: null,
            },
          ],
        },
      ]),
    );

    const result = await getEpisodePageDubbingProjectData(1);

    expectInnerMediaJoin();
    expectMediaFilter("tv", 1);

    expect(result.dubbingProjects).toEqual([
      {
        id: 17,
        language: "fr-FR",
        studio_data: { id: 3, name: "Studio", logo_url: null },
        workCount: 3,
        voiceActorCount: 1,
      },
    ]);
    expect(result.activeProjectId).toBe(17);
    expect(result.activeProjectWorks).toEqual([
      {
        id: 12,
        actor_id: 44,
        character_name: "Character",
        note: "First note",
        voice_actor_id: 5,
      },
      {
        id: 13,
        actor_id: 45,
        character_name: "Second character",
        note: null,
        voice_actor_id: 5,
      },
      {
        id: 14,
        actor_id: null,
        character_name: "Unassigned",
        note: null,
        voice_actor_id: null,
      },
    ]);
    expect(result.voiceActors).toHaveLength(1);
    expect(result.voiceActors[0]).toMatchObject({
      id: 5,
      firstname: "Voice",
      lastname: "Actor",
    });
    expect(queryMocks.selectedColumns[0]).not.toContain("performance");
    expect(queryMocks.selectedColumns[0]).not.toContain("voice_actor_name");
  });

  it("selects public crew fields for pages that render crew", async () => {
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock([]));

    await getDubbingProjects(1, "toy");

    expectInnerMediaJoin();
    expectMediaFilter("toy", 1);
    expect(queryMocks.selectedColumns[0]).toContain("crew:dubbing_project_crew");
    expect(queryMocks.selectedColumns[0]).toContain(
      "person:voice_actors(id, firstname, lastname, profile_picture)",
    );
    expect(queryMocks.selectedColumns[0]).not.toContain("*");
  });

  it("projects podcast detail projects while retaining cast, studio, and crew data", async () => {
    const rows = [
      {
        media: { id: 900, kind: "podcast", content_id: 1 },
        id: 17,
        language: "fr-FR",
        studio_data: {
          id: 3,
          name: "Studio",
          logo_url: "https://example.com/logo.png",
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

    expectInnerMediaJoin();
    expectMediaFilter("podcast", 1);
    expect(projects[0]).not.toHaveProperty("media");
    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios");
    expect(queryMocks.selectedColumns[0]).toContain("crew:dubbing_project_crew");
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors");
    expect(projects).toMatchObject(rows.map(({ media: _media, ...project }) => project));
  });

  it("projects advertisement detail projects while retaining cast, studio, and crew data", async () => {
    const rows = [
      {
        media: { id: 900, kind: "advertisement", content_id: 31 },
        id: 17,
        language: "fr-FR",
        studio_data: {
          id: 3,
          name: "Studio",
          logo_url: "https://example.com/logo.png",
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
              profile_picture: null,
            },
          },
        ],
        crew: [
          {
            id: 20,
            person_id: 5,
            job_id: 9,
            job: { name: "Director" },
            person: {
              id: 5,
              firstname: "Voice",
              lastname: "Actor",
              profile_picture: null,
            },
          },
        ],
      },
    ];
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock(rows));

    const projects = await getAdvertisementPageDubbingProjects(31);

    expectInnerMediaJoin();
    expectMediaFilter("advertisement", 31);
    expect(projects).toEqual(rows.map(({ media: _media, ...project }) => project));
    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios");
    expect(queryMocks.selectedColumns[0]).toContain("crew:dubbing_project_crew");
  });

  it("routes advertisement page projection requests to the compact query", async () => {
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock([]));

    await getDubbingProjectsForMediaEndpoint(31, "advertisement", "advertisement-page");

    expectInnerMediaJoin();
    expectMediaFilter("advertisement", 31);

    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios");
  });

  it("keeps public credits and crew when no page projection is requested", async () => {
    const rows = [
      {
        id: 17,
        media: { id: 900, kind: "movie", content_id: 1 },
        language: "fr-FR",
        studio_data: {
          id: 3,
          name: "Studio",
          logo_url: "https://example.com/logo.png",
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
              voice_actor_name: "Actor",
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

    const { media: _media, ...publicRow } = rows[0] ?? {};
    // The database only returns `media`; the payload keeps the legacy content_id/content_type and hides `media`.
    expect(projects).toEqual([{ ...publicRow, content_id: 1, content_type: "movie" }]);
    expect(projects[0]).not.toHaveProperty("media");
    expectInnerMediaJoin();
    expectMediaFilter("movie", 1);
    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("crew:dubbing_project_crew");
    expect(projects[0]?.crew[0]?.person).toMatchObject({
      id: 5,
      firstname: "Voice",
      profile_picture: "https://example.com/voice-actor.png",
    });
  });

  it("selects compact fields only for the explicit media-page projection", async () => {
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock([]));

    await expect(getDubbingProjectsForMediaEndpoint(1, "movie", "media-page")).resolves.toEqual([]);

    expectInnerMediaJoin();
    expectMediaFilter("movie", 1);
    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios");
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors");
  });

  it("selects toy page fields while retaining crew, cast, and studio data", async () => {
    const rows = [
      {
        media: { id: 900, kind: "toy", content_id: 31 },
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

    expectInnerMediaJoin();
    expectMediaFilter("toy", 31);
    expect(projects[0]).not.toHaveProperty("media");
    expect(projects).toMatchObject(rows.map(({ media: _media, ...project }) => project));
    expect(projects[0]?.crew?.[0]?.person).not.toHaveProperty("profile_picture");
    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios(id, name)");
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors(id");
    expect(queryMocks.selectedColumns[0]).toContain("crew:dubbing_project_crew");
    expect(queryMocks.selectedColumns[0]).toContain("job:jobs(name)");
  });

  it("selects game page fields while retaining character links and studio data", async () => {
    const rows = [
      {
        media: { id: 900, kind: "video_game", content_id: 31 },
        id: 21,
        language: "fr-FR",
        studio_data: {
          id: 7,
          name: "Game Studio",
          logo_url: "https://example.com/logo.jpg",
        },
        works: [
          {
            id: 91,
            actor_id: 42,
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

    expectInnerMediaJoin();
    expectMediaFilter("video_game", 31);
    expect(projects[0]).not.toHaveProperty("media");
    expect(projects).toMatchObject(
      rows.map(({ media: _media, ...project }) => ({ ...project, crew: [] })),
    );
    expect(queryMocks.selectedColumns[0]).not.toContain("*");
    expect(queryMocks.selectedColumns[0]).toContain("studio_data:studios(id, name, logo_url)");
    expect(queryMocks.selectedColumns[0]).toContain("game_character_id");
    expect(queryMocks.selectedColumns[0]).not.toMatch(/(?<![a-z_])character_id/);
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors(id");
    expect(projects[0]?.crew).toEqual([]);
  });

  it("returns an empty array when the requested dubbing project list is empty", async () => {
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock([]));

    await expect(getDubbingProjectsForMediaEndpoint(1, "movie", "media-page")).resolves.toEqual([]);
  });

  it("returns season project metrics instead of serializing each work", async () => {
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
          { voice_actor: { id: 5 } },
          { voice_actor: { id: 5 } },
          { voice_actor: { id: 8 } },
          { voice_actor: null },
        ],
      },
      {
        id: 18,
        language: "en-US",
        studio_data: null,
        works: [{ voice_actor: null }],
      },
    ];
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock(rows));

    const projects = await getSeasonPageDubbingProjects(31, "tv");

    expectInnerMediaJoin();
    expectMediaFilter("tv", 31);

    expect(projects).toEqual([
      {
        id: 17,
        language: "fr-FR",
        studio_data: rows[0]?.studio_data,
        has_voice_actor: true,
        voice_actor_count: 2,
        work_count: 4,
      },
      {
        id: 18,
        language: "en-US",
        studio_data: null,
        has_voice_actor: false,
        voice_actor_count: 0,
        work_count: 1,
      },
    ]);
    expect(projects[0]).not.toHaveProperty("works");
    expect(queryMocks.selectedColumns[0]).toContain("voice_actor:voice_actors(id)");
  });
});

describe("actor page work query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.selectedColumns.length = 0;
    queryMocks.eqCalls.length = 0;
    queryMocks.inCalls.length = 0;
  });

  it("selects reviewed_status for page roles", async () => {
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock([]));
    await getActorPageWorkByActor(31);
    expect(queryMocks.selectedColumns[0]).toContain("reviewed_status");
  });

  it("throws Supabase errors so callers can avoid caching a degraded empty result", async () => {
    const error = new Error("Database unavailable");
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock([], error));

    await expect(getActorPageWorkByActor(31)).rejects.toBe(error);
  });
});
