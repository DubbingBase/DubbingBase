import { describe, it, expect } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { useDubbingProjectTabs } from "./useDubbingProjectTabs";

const state = {
  table: "",
  select: "",
  eq: new Array<[string, unknown]>(),
  rows: new Array<unknown>(),
};

const createFakeClient = () => {
  const builder = {
    select: (columns: string) => {
      state.select = columns;
      return builder;
    },
    eq: (column: string, value: unknown) => {
      state.eq.push([column, value]);
      return builder;
    },
    then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
      resolve({ data: state.rows, error: null }),
  };
  return {
    from: (table: string) => {
      state.table = table;
      return builder;
    },
  };
};

mockNuxtImport("useSupabaseClient", () => () => createFakeClient());

describe("useDubbingProjectTabs.fetchProjectTabs", () => {
  it("filters on the inner-joined media and maps rows without the embed", async () => {
    state.eq.length = 0;
    state.rows = [
      {
        id: 4,
        language: "fr-FR",
        studio_id: 2,
        studios: { name: "Studio" },
        media: { id: 9, kind: "video_game", content_id: 77 },
      },
      { id: 5, language: "en-US", studio_id: null, studios: null, media: null },
    ];

    const tabs = await useDubbingProjectTabs().fetchProjectTabs("video_game", 77);

    expect(state.table).toBe("dubbing_projects");
    expect(state.select).toContain("media:media_id!inner(id,kind,content_id)");
    expect(state.eq).toEqual([
      ["media.kind", "video_game"],
      ["media.content_id", 77],
    ]);
    expect(tabs).toEqual([
      { id: 4, language: "fr-FR", studio_id: 2, studios: { name: "Studio" } },
      { id: 5, language: "en-US", studio_id: null, studios: null },
    ]);
    for (const tab of tabs) expect(tab).not.toHaveProperty("media");
  });

  it("returns an empty list when there is no data", async () => {
    state.eq.length = 0;
    state.rows = [];
    await expect(useDubbingProjectTabs().fetchProjectTabs("tv", 1)).resolves.toEqual([]);
  });
});
