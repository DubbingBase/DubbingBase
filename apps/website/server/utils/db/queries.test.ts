import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
  useSupabaseAdmin: vi.fn(),
  selectedColumns: new Array<string>(),
}));

vi.mock("./client", () => ({
  useSupabaseAdmin: queryMocks.useSupabaseAdmin,
}));

import { getDubbingProjects, getMediaPageDubbingProjects } from "./queries";

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
    then(
      resolve: (value: typeof result) => unknown,
      reject: (reason: unknown) => unknown,
    ) {
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
        studio_data: { id: 3, name: "Studio", logo_url: null },
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
              voice_actor_name: null,
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
  });

  it("keeps the full projection available to pages that render crew", async () => {
    queryMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock([]));

    await getDubbingProjects(1, "toy");

    expect(queryMocks.selectedColumns[0]).toContain(
      "crew:dubbing_project_crew",
    );
    expect(queryMocks.selectedColumns[0]).toContain("person:voice_actors(*)");
  });
});
