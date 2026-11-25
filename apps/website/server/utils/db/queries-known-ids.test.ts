import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  isKnownMedia: vi.fn(),
  isKnownActor: vi.fn(),
}));

vi.mock("./client", () => ({
  useSupabaseAdmin: () => ({ from: mocks.from }),
}));

vi.mock("./known-content-ids", () => ({
  isKnownMedia: mocks.isKnownMedia,
  isKnownActor: mocks.isKnownActor,
}));

import {
  getActorPageWorkByActor,
  getAdvertisementPageDubbingProjects,
  getDubbingProjects,
  getDubbingProjectsForMediaEndpoint,
  getEpisodePageDubbingProjectData,
  getEpisodePageProjectWorks,
  getGamePageDubbingProjects,
  getMediaPageDubbingProjectData,
  getMediaPageDubbingProjectSummaries,
  getMediaPageDubbingProjects,
  getPodcastPageDubbingProjects,
  getSeasonPageDubbingProjects,
  getToyPageDubbingProjects,
  getWorkByActor,
} from "./queries";

/** A query builder that resolves to no rows, whatever is chained on it. */
function emptyQuery() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.in = chain;
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
  builder.then = (resolve: (value: { data: never[]; error: null }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return builder;
}

describe("page queries skip the database for ids DubbingBase has no data for", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation(emptyQuery);
  });

  describe("unknown media", () => {
    beforeEach(() => {
      mocks.isKnownMedia.mockResolvedValue(false);
    });

    it.each([
      ["getDubbingProjects", () => getDubbingProjects(550, "movie"), []],
      [
        "getDubbingProjectsForMediaEndpoint",
        () => getDubbingProjectsForMediaEndpoint(550, "movie", "media-page"),
        [],
      ],
      ["getAdvertisementPageDubbingProjects", () => getAdvertisementPageDubbingProjects(5), []],
      [
        "getMediaPageDubbingProjectData",
        () => getMediaPageDubbingProjectData(550, "movie"),
        { dubbingProjects: [], voiceActors: [] },
      ],
      ["getMediaPageDubbingProjects", () => getMediaPageDubbingProjects(550, "movie"), []],
      [
        "getMediaPageDubbingProjectSummaries",
        () => getMediaPageDubbingProjectSummaries(550, "movie"),
        [],
      ],
      ["getPodcastPageDubbingProjects", () => getPodcastPageDubbingProjects(5), []],
      ["getToyPageDubbingProjects", () => getToyPageDubbingProjects(5), []],
      ["getGamePageDubbingProjects", () => getGamePageDubbingProjects(5), []],
      [
        "getEpisodePageDubbingProjectData",
        () => getEpisodePageDubbingProjectData(550),
        { dubbingProjects: [], activeProjectId: null, activeProjectWorks: [], voiceActors: [] },
      ],
      [
        "getEpisodePageProjectWorks",
        () => getEpisodePageProjectWorks(550, 7),
        { projectId: 7, works: [], voiceActors: [] },
      ],
      ["getSeasonPageDubbingProjects", () => getSeasonPageDubbingProjects(550, "tv"), []],
    ])("%s returns its empty value without a Supabase call", async (_name, call, empty) => {
      expect(await call()).toEqual(empty);
      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("looks the media up under the kind of the page, not just the id", async () => {
      await getGamePageDubbingProjects(1020);
      await getEpisodePageProjectWorks(550, 7);
      await getMediaPageDubbingProjects(603, "movie");

      expect(mocks.isKnownMedia.mock.calls).toEqual([
        ["video_game", 1020],
        ["tv", 550],
        ["movie", 603],
      ]);
    });
  });

  describe("known media", () => {
    it("still queries the database", async () => {
      mocks.isKnownMedia.mockResolvedValue(true);

      await getDubbingProjects(550, "movie");
      await getEpisodePageDubbingProjectData(550);

      expect(mocks.from).toHaveBeenCalledTimes(2);
      expect(mocks.from).toHaveBeenCalledWith("dubbing_projects");
    });
  });

  describe("actors", () => {
    it("returns no roles for an unknown actor without a Supabase call", async () => {
      mocks.isKnownActor.mockResolvedValue(false);

      expect(await getActorPageWorkByActor(1_396_774)).toEqual([]);
      expect(await getWorkByActor(1_396_774)).toEqual([]);
      expect(mocks.isKnownActor).toHaveBeenCalledWith(1_396_774);
      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("still queries the database for an actor with data", async () => {
      mocks.isKnownActor.mockResolvedValue(true);

      await getActorPageWorkByActor(10);
      await getWorkByActor(10);

      expect(mocks.from).toHaveBeenCalledTimes(2);
      expect(mocks.from).toHaveBeenCalledWith("work");
    });
  });
});
