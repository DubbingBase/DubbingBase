import {
  createApp,
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  getRouterParam,
  toWebHandler,
  type EventHandler,
} from "h3";
import inspector from "node:inspector";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTrending: vi.fn(),
  fetchMediaCredits: vi.fn(),
  getPersonWithCredits: vi.fn(),
  getActorPageWorkByActor: vi.fn(),
  getWorkByActor: vi.fn(),
  getDubbingProjectsForMediaEndpoint: vi.fn(),
  getMediaWithVoiceActors: vi.fn(),
  getCharacterProfilePictures: vi.fn(),
  getVoiceActorWithWorkAndMedia: vi.fn(),
}));

vi.mock("../server/utils/index", () => ({
  useTmdbClient: () => ({
    getTrending: mocks.getTrending,
    fetchMediaCredits: mocks.fetchMediaCredits,
    getPersonWithCredits: mocks.getPersonWithCredits,
  }),
}));

vi.mock("../server/utils/services/media", () => ({
  MediaService: class {
    getMediaWithVoiceActors() {
      return mocks.getMediaWithVoiceActors();
    }

    getCharacterProfilePictures() {
      return mocks.getCharacterProfilePictures();
    }

    getVoiceActorWithWorkAndMedia() {
      return mocks.getVoiceActorWithWorkAndMedia();
    }
  },
}));

vi.mock("../server/utils/db/queries", () => ({
  getActorPageWorkByActor: mocks.getActorPageWorkByActor,
  getWorkByActor: mocks.getWorkByActor,
  getDubbingProjectsForMediaEndpoint: mocks.getDubbingProjectsForMediaEndpoint,
}));

vi.mock("../server/utils/background", () => ({
  scheduleBackgroundTask: vi.fn(),
}));

vi.mock("../server/utils/notifications/discord", () => ({
  sendDiscordAdminNotification: vi.fn(),
}));

type CpuProfileNode = {
  id: number;
  callFrame: {
    functionName: string;
    url: string;
    lineNumber: number;
  };
};

type CpuProfile = {
  nodes: CpuProfileNode[];
  samples: number[];
  timeDeltas: number[];
};

type RequestResult = {
  bytes: number;
  body: unknown;
};

type RouteWorkload = {
  name: string;
  path: string;
  fixture: Record<string, number | string>;
  prepare: () => void;
  request: () => Promise<number>;
  verify: () => Promise<void>;
  dependencyCalls: () => Record<string, number>;
};

let handlers: {
  trendingMovies: EventHandler;
  trendingShows: EventHandler;
  movie: EventHandler;
  show: EventHandler;
  actor: EventHandler;
  voiceActor: EventHandler;
};

beforeAll(async () => {
  if (process.env.E2E_TEST === "true") {
    throw new Error("Route CPU profiling must not run with E2E_TEST=true.");
  }

  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getRouterParam", getRouterParam);
  vi.stubGlobal("getHeader", getHeader);
  vi.stubGlobal("getQuery", getQuery);
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("fetch", () => {
    throw new Error("Unexpected network request in route CPU benchmark.");
  });

  handlers = {
    trendingMovies: (await import("../server/api/trending/movies.get")).default,
    trendingShows: (await import("../server/api/trending/shows.get")).default,
    movie: (await import("../server/api/movie/[id].get")).default,
    show: (await import("../server/api/show/[id].get")).default,
    actor: (await import("../server/api/actor/[id].get")).default,
    voiceActor: (await import("../server/api/voice-actor/[id].get")).default,
  };
});

afterAll(() => vi.unstubAllGlobals());

type Dataset = "representative" | "large";

function makeTrendingResults(kind: "movie" | "tv", count: number) {
  return {
    results: Array.from({ length: count }, (_, index) => ({
      id: 100_000 + index,
      title: kind === "movie" ? `CI fixture movie ${index}` : undefined,
      name: kind === "tv" ? `CI fixture show ${index}` : undefined,
      adult: false,
      poster_path: `/poster-${index}.jpg`,
      backdrop_path: `/backdrop-${index}.jpg`,
    })),
  };
}

function makeCast(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: 200_000 + index,
    title: `CI fixture movie ${index}`,
    name: `CI fixture show ${index}`,
    character: `CI fixture character ${index}`,
    poster_path: `/cast-${index}.jpg`,
    profile_path: `/person-${index}.jpg`,
    release_date: "2020-01-01",
    first_air_date: "2021-01-01",
    popularity: index,
  }));
}

function makeActor(creditCount: number) {
  const movieCreditCount = Math.floor(creditCount * 0.6);
  return {
    id: 6384,
    name: "CI fixture actor",
    biography: "Deterministic local route CPU fixture. ".repeat(20),
    birthday: "1980-01-01",
    deathday: null,
    place_of_birth: "Local fixture",
    known_for_department: "Acting",
    profile_path: "/actor.jpg",
    movie_credits: {
      cast: Array.from({ length: movieCreditCount }, (_, index) => ({
        id: 300_000 + index,
        title: `CI fixture movie ${index}`,
        character: `CI movie character ${index}`,
        poster_path: `/movie-${index}.jpg`,
        release_date: "2020-01-01",
      })),
    },
    tv_credits: {
      cast: Array.from({ length: creditCount - movieCreditCount }, (_, index) => ({
        id: 400_000 + index,
        name: `CI fixture show ${index}`,
        character: `CI show character ${index}`,
        poster_path: `/show-${index}.jpg`,
        first_air_date: "2021-01-01",
      })),
    },
  };
}

function makeActorRoles(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const voiceActorId = 50_000 + (index % 100);
    return {
      id: index + 1,
      performance: `CI fixture performance ${index}`,
      dubbing_projects: {
        language: index % 2 === 0 ? "fr-FR" : "en-US",
        content_id: 100_000 + index,
      },
      voice_actors: {
        id: voiceActorId,
        firstname: `CI Voice ${voiceActorId}`,
        lastname: "Actor",
        profile_picture: `https://supabase.fixture.invalid/voice-actor-${voiceActorId}.jpg`,
      },
    };
  });
}

function makeDubbingProjects(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    language: index % 2 === 0 ? "fr-FR" : "en-US",
    studio_data: { id: 10_000 + index, name: `CI studio ${index}` },
    works: [
      {
        id: index + 1,
        actor_id: 200_000 + index,
        character_name: `CI character ${index}`,
        performance: `CI performance ${index}`,
        voice_actor: {
          id: 50_000 + (index % 100),
          firstname: `CI Voice ${index % 100}`,
          lastname: "Actor",
          profile_picture: `/voice-actor-${index % 100}.jpg`,
        },
      },
    ],
  }));
}

function makeMediaResult(creditCount: number) {
  const cast = makeCast(creditCount);
  return {
    media: {
      id: 85,
      title: "CI fixture movie",
      name: "CI fixture show",
      overview: "Deterministic synthetic media data. ".repeat(20),
      poster_path: "/media-poster.jpg",
      backdrop_path: "/media-backdrop.jpg",
      release_date: "2020-01-01",
      first_air_date: "2021-01-01",
      external_ids: {},
      credits: { cast, crew: [] },
      aggregate_credits: { cast },
    },
    collection: null,
  };
}

function makeVoiceActorResult(workCount: number, uniqueMediaCount: number) {
  return {
    voiceActor: {
      id: 1,
      firstname: "CI fixture voice actor",
      lastname: "Actor",
      profile_picture: null,
      bio: "Deterministic local route CPU fixture. ".repeat(20),
    },
    enhancedWorks: Array.from({ length: workCount }, (_, index) => ({
      work: {
        id: index + 1,
        actor_id: 200_000 + index,
        performance: `CI performance ${index}`,
        note: null,
      },
      media: {
        id: 300_000 + (index % uniqueMediaCount),
        title: `CI fixture media ${index % uniqueMediaCount}`,
        name: `CI fixture media ${index % uniqueMediaCount}`,
        media_type: index % 2 === 0 ? "movie" : "tv",
      },
      data: {
        character: `CI character ${index}`,
        actor: { id: 200_000 + index, name: `CI actor ${index}` },
      },
      searchText: `ci fixture ${index}`,
    })),
    medias: Array.from({ length: uniqueMediaCount }, (_, index) => ({
      id: 300_000 + index,
      title: `CI fixture media ${index}`,
      media_type: index % 2 === 0 ? "movie" : "tv",
    })),
    characterProfilePictures: [],
    potentialWikipediaUrl: null,
    backdropPath: null,
  };
}

function makeRequest(handler: EventHandler, path: string, id?: string) {
  const app = createApp();
  app.use(
    defineEventHandler((event) => {
      if (id !== undefined) event.context.params = { id };
      return handler(event);
    }),
  );
  const routeFetch = toWebHandler(app);

  async function sendRequest(): Promise<Response> {
    const response = await routeFetch(new Request(`http://localhost${path}`));
    if (response.status !== 200) {
      throw new Error(`Synthetic API route ${path} returned HTTP ${response.status}.`);
    }
    return response;
  }

  return {
    async invoke() {
      const response = await sendRequest();
      return (await response.arrayBuffer()).byteLength;
    },
    async json(): Promise<RequestResult> {
      const response = await sendRequest();
      const body: unknown = await response.json();
      const text = JSON.stringify(body);
      if (text === undefined) throw new Error(`Synthetic API route ${path} returned no JSON.`);
      return { bytes: Buffer.byteLength(text), body };
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function makeWorkloads(dataset: Dataset): RouteWorkload[] {
  const sizes =
    dataset === "representative"
      ? {
          trendingResults: 24,
          mediaCredits: 180,
          dubbingProjects: 40,
          actorCredits: 640,
          actorRoles: 24,
          voiceActorWorks: 24,
          uniqueVoiceActorMedia: 12,
        }
      : {
          trendingResults: 500,
          mediaCredits: 1200,
          dubbingProjects: 500,
          actorCredits: 1200,
          actorRoles: 500,
          voiceActorWorks: 500,
          uniqueVoiceActorMedia: 100,
        };
  const mediaResult = makeMediaResult(sizes.mediaCredits);
  const dubbingProjects = makeDubbingProjects(sizes.dubbingProjects);
  const actor = makeActor(sizes.actorCredits);
  const actorRoles = makeActorRoles(sizes.actorRoles);
  const voiceActorResult = makeVoiceActorResult(sizes.voiceActorWorks, sizes.uniqueVoiceActorMedia);
  const trendingMovies = makeTrendingResults("movie", sizes.trendingResults);
  const trendingShows = makeTrendingResults("tv", sizes.trendingResults);

  const moviesRequest = makeRequest(handlers.trendingMovies, "/api/trending/movies?lang=fr-FR");
  const showsRequest = makeRequest(handlers.trendingShows, "/api/trending/shows?lang=fr-FR");
  const movieRequest = makeRequest(handlers.movie, "/api/movie/85?projection=media-page", "85");
  const showRequest = makeRequest(handlers.show, "/api/show/1396?projection=media-page", "1396");
  const actorRequest = makeRequest(
    handlers.actor,
    "/api/actor/6384?projection=actor-page&filmographyPage=1",
    "6384",
  );
  const voiceActorRequest = makeRequest(handlers.voiceActor, "/api/voice-actor/1?lang=fr-FR", "1");

  return [
    {
      name: "home-movies",
      path: "/api/trending/movies",
      fixture: { results: sizes.trendingResults },
      prepare: () => mocks.getTrending.mockResolvedValue(trendingMovies),
      request: moviesRequest.invoke,
      verify: async () => {
        const result = await moviesRequest.json();
        if (!isRecord(result.body) || !Array.isArray(result.body.results)) {
          throw new Error("Home movie fixture was not returned.");
        }
        expect(result.body.results).toHaveLength(sizes.trendingResults);
        expect(result.body.results[0]).toMatchObject({ title: "CI fixture movie 0" });
      },
      dependencyCalls: () => ({ tmdb: mocks.getTrending.mock.calls.length }),
    },
    {
      name: "home-shows",
      path: "/api/trending/shows",
      fixture: { results: sizes.trendingResults },
      prepare: () => mocks.getTrending.mockResolvedValue(trendingShows),
      request: showsRequest.invoke,
      verify: async () => {
        const result = await showsRequest.json();
        if (!isRecord(result.body) || !Array.isArray(result.body.results)) {
          throw new Error("Home show fixture was not returned.");
        }
        expect(result.body.results).toHaveLength(sizes.trendingResults);
        expect(result.body.results[0]).toMatchObject({ name: "CI fixture show 0" });
      },
      dependencyCalls: () => ({ tmdb: mocks.getTrending.mock.calls.length }),
    },
    {
      name: "movie",
      path: "/api/movie/85?projection=media-page",
      fixture: {
        credits: sizes.mediaCredits,
        dubbingProjects: sizes.dubbingProjects,
      },
      prepare: () => {
        mocks.getMediaWithVoiceActors.mockResolvedValue(mediaResult);
        mocks.getCharacterProfilePictures.mockResolvedValue({ characters: [], tvdbId: null });
        mocks.getDubbingProjectsForMediaEndpoint.mockResolvedValue(dubbingProjects);
      },
      request: movieRequest.invoke,
      verify: async () => {
        const result = await movieRequest.json();
        if (!isRecord(result.body) || !isRecord(result.body.movie)) {
          throw new Error("Movie fixture was not returned.");
        }
        expect(result.body.movie.title).toBe("CI fixture movie");
        expect(result.body.dubbingProjects).toHaveLength(sizes.dubbingProjects);
      },
      dependencyCalls: () => ({
        media: mocks.getMediaWithVoiceActors.mock.calls.length,
        dubbingProjects: mocks.getDubbingProjectsForMediaEndpoint.mock.calls.length,
      }),
    },
    {
      name: "show",
      path: "/api/show/1396?projection=media-page",
      fixture: {
        credits: sizes.mediaCredits,
        dubbingProjects: sizes.dubbingProjects,
      },
      prepare: () => {
        mocks.getMediaWithVoiceActors.mockResolvedValue(mediaResult);
        mocks.getCharacterProfilePictures.mockResolvedValue({ characters: [], tvdbId: null });
        mocks.getDubbingProjectsForMediaEndpoint.mockResolvedValue(dubbingProjects);
        mocks.fetchMediaCredits.mockResolvedValue({ cast: makeCast(sizes.mediaCredits) });
      },
      request: showRequest.invoke,
      verify: async () => {
        const result = await showRequest.json();
        if (!isRecord(result.body) || !isRecord(result.body.serie)) {
          throw new Error("Show fixture was not returned.");
        }
        expect(result.body.serie.name).toBe("CI fixture show");
        expect(result.body.dubbingProjects).toHaveLength(sizes.dubbingProjects);
      },
      dependencyCalls: () => ({
        media: mocks.getMediaWithVoiceActors.mock.calls.length,
        aggregateCredits: mocks.fetchMediaCredits.mock.calls.length,
        dubbingProjects: mocks.getDubbingProjectsForMediaEndpoint.mock.calls.length,
      }),
    },
    {
      name: "actor",
      path: "/api/actor/6384?projection=actor-page&filmographyPage=1",
      fixture: {
        credits: sizes.actorCredits,
        voiceRoles: sizes.actorRoles,
        uniqueVoiceActors: Math.min(sizes.actorRoles, 100),
      },
      prepare: () => {
        mocks.getPersonWithCredits.mockResolvedValue(actor);
        mocks.getActorPageWorkByActor.mockResolvedValue(actorRoles);
      },
      request: actorRequest.invoke,
      verify: async () => {
        const result = await actorRequest.json();
        if (!isRecord(result.body) || !isRecord(result.body.actor)) {
          throw new Error("Actor fixture was not returned.");
        }
        const actorData = result.body.actor;
        const credits = actorData.credits;
        if (!isRecord(credits) || !Array.isArray(credits.cast)) {
          throw new Error("Actor credits are missing from the response.");
        }
        expect(result.body.filmographyCount).toBe(sizes.actorCredits);
        expect(credits.cast).toHaveLength(12);
        expect(actorData.voice_roles).toHaveLength(sizes.actorRoles);
      },
      dependencyCalls: () => ({
        tmdb: mocks.getPersonWithCredits.mock.calls.length,
        voiceRoles: mocks.getActorPageWorkByActor.mock.calls.length,
      }),
    },
    {
      name: "voice-actor",
      path: "/api/voice-actor/1?lang=fr-FR",
      fixture: {
        works: sizes.voiceActorWorks,
        uniqueMedia: sizes.uniqueVoiceActorMedia,
      },
      prepare: () => mocks.getVoiceActorWithWorkAndMedia.mockResolvedValue(voiceActorResult),
      request: voiceActorRequest.invoke,
      verify: async () => {
        const result = await voiceActorRequest.json();
        if (!isRecord(result.body) || !isRecord(result.body.voiceActor)) {
          throw new Error("Voice actor fixture was not returned.");
        }
        expect(result.body.voiceActor.firstname).toBe("CI fixture voice actor");
        expect(result.body.enhancedWorks).toHaveLength(sizes.voiceActorWorks);
        expect(result.body.medias).toHaveLength(sizes.uniqueVoiceActorMedia);
      },
      dependencyCalls: () => ({
        mediaService: mocks.getVoiceActorWithWorkAndMedia.mock.calls.length,
      }),
    },
  ];
}

async function runBatch(invoke: () => Promise<number>, requestCount: number) {
  const before = process.cpuUsage();
  let responseBytes = 0;
  for (let index = 0; index < requestCount; index += 1) {
    responseBytes += await invoke();
  }
  const usage = process.cpuUsage(before);
  return {
    userMicrosPerRequest: usage.user / requestCount,
    systemMicrosPerRequest: usage.system / requestCount,
    totalMicrosPerRequest: (usage.user + usage.system) / requestCount,
    responseBytesPerRequest: responseBytes / requestCount,
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function summarize(values: number[]) {
  return {
    median: median(values),
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}

function isCpuProfile(value: unknown): value is CpuProfile {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.samples)) return false;
  if (!Array.isArray(value.timeDeltas)) return false;

  return (
    value.nodes.every(
      (node) =>
        isRecord(node) &&
        typeof node.id === "number" &&
        isRecord(node.callFrame) &&
        typeof node.callFrame.functionName === "string" &&
        typeof node.callFrame.url === "string" &&
        typeof node.callFrame.lineNumber === "number",
    ) &&
    value.samples.every((sample) => typeof sample === "number") &&
    value.timeDeltas.every((delta) => typeof delta === "number")
  );
}

async function captureCpuProfile(invoke: () => Promise<number>, requestCount: number) {
  const session = new inspector.Session();
  session.connect();
  try {
    await new Promise<void>((resolve, reject) => {
      session.post("Profiler.enable", (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    await new Promise<void>((resolve, reject) => {
      session.post("Profiler.setSamplingInterval", { interval: 1000 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    await new Promise<void>((resolve, reject) => {
      session.post("Profiler.start", (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    for (let index = 0; index < requestCount; index += 1) {
      await invoke();
    }

    return await new Promise<CpuProfile>((resolve, reject) => {
      session.post("Profiler.stop", (error, result) => {
        if (error) {
          reject(error);
        } else if (isCpuProfile(result.profile)) {
          resolve(result.profile);
        } else {
          reject(new Error("V8 returned an invalid CPU profile."));
        }
      });
    });
  } finally {
    session.disconnect();
  }
}

function profileHotFrames(profile: CpuProfile) {
  const nodesById = new Map(profile.nodes.map((node) => [node.id, node]));
  const samplesByFrame = new Map<
    string,
    { functionName: string; source: string; sampledMicros: number }
  >();
  let relevantSampleCount = 0;

  for (let index = 0; index < profile.samples.length; index += 1) {
    const node = nodesById.get(profile.samples[index]);
    const sampledMicros = profile.timeDeltas[index];
    if (!node || !Number.isFinite(sampledMicros)) continue;

    const frameUrl = node.callFrame.url;
    const source = frameUrl.startsWith("file://")
      ? relative(process.cwd(), frameUrl.replace(/^file:\/\//, ""))
      : frameUrl || "native";
    const isServerFrame = source.startsWith("server/") || source.startsWith("apps/website/server/");
    const isH3Frame = source.includes("/node_modules/h3/");
    if (!isServerFrame && !isH3Frame) continue;

    relevantSampleCount += 1;
    const h3PackageMarker = "/node_modules/h3/";
    const h3PackageIndex = source.lastIndexOf(h3PackageMarker);
    const frameSource =
      h3PackageIndex >= 0 ? `h3/${source.slice(h3PackageIndex + h3PackageMarker.length)}` : source;
    const functionName = node.callFrame.functionName || "(anonymous)";
    const key = `${frameSource}:${node.callFrame.lineNumber + 1}:${functionName}`;
    const current = samplesByFrame.get(key);
    samplesByFrame.set(key, {
      functionName,
      source: `${frameSource}:${node.callFrame.lineNumber + 1}`,
      sampledMicros: (current?.sampledMicros ?? 0) + sampledMicros,
    });
  }

  const totalSampledMicros = [...samplesByFrame.values()].reduce(
    (total, frame) => total + frame.sampledMicros,
    0,
  );
  return {
    sampleCount: profile.samples.length,
    relevantSampleCount,
    topSampledFrames: [...samplesByFrame.values()]
      .sort((left, right) => right.sampledMicros - left.sampledMicros)
      .slice(0, 8)
      .map((frame) => ({
        ...frame,
        sampleSharePercent:
          totalSampledMicros > 0 ? (frame.sampledMicros / totalSampledMicros) * 100 : 0,
      })),
  };
}

describe.skipIf(process.env.ROUTE_CPU_BENCHMARK !== "true")(
  "multi-route synthetic CPU measurement",
  () => {
    it("profiles warmed API handlers with deterministic representative and large fixtures", async () => {
      const warmupRequests = 20;
      const measuredRounds = 5;
      const requestsPerRound = 50;
      const profileRequests = 100;
      const workloads: Array<Record<string, unknown>> = [];

      const datasets: Dataset[] = ["representative", "large"];
      for (const dataset of datasets) {
        for (const workload of makeWorkloads(dataset)) {
          vi.clearAllMocks();
          workload.prepare();
          await workload.verify();
          vi.clearAllMocks();

          for (let index = 0; index < warmupRequests; index += 1) {
            await workload.request();
          }

          const rounds: Array<Awaited<ReturnType<typeof runBatch>>> = [];
          for (let round = 0; round < measuredRounds; round += 1) {
            rounds.push(await runBatch(workload.request, requestsPerRound));
          }
          const profile =
            dataset === "large"
              ? await captureCpuProfile(workload.request, profileRequests)
              : undefined;
          const profileSummary = profile ? profileHotFrames(profile) : undefined;
          if (profileSummary) {
            expect(profileSummary.relevantSampleCount).toBeGreaterThan(0);
          }
          const dependencyCalls = workload.dependencyCalls();
          const routeRequestCount =
            warmupRequests +
            measuredRounds * requestsPerRound +
            (dataset === "large" ? profileRequests : 0);
          expect(Object.values(dependencyCalls).every((count) => count === routeRequestCount)).toBe(
            true,
          );

          workloads.push({
            name: workload.name,
            dataset,
            path: workload.path,
            fixture: workload.fixture,
            warmupRequests,
            measuredRounds,
            requestsPerRound,
            profileRequests: dataset === "large" ? profileRequests : 0,
            cpuMicrosPerRequest: {
              user: summarize(rounds.map((round) => round.userMicrosPerRequest)),
              system: summarize(rounds.map((round) => round.systemMicrosPerRequest)),
              total: summarize(rounds.map((round) => round.totalMicrosPerRequest)),
            },
            responseBytesPerRequest: summarize(
              rounds.map((round) => round.responseBytesPerRequest),
            ),
            routeRequestCount,
            dependencyCalls,
            profile: profileSummary,
          });

          if (profile) {
            const outputPath = process.env.ROUTE_CPU_OUTPUT ?? "/tmp/route-cpu.json";
            const profileName = workload.name.replace(/[^a-z0-9-]/g, "-");
            await mkdir(dirname(outputPath), { recursive: true });
            await writeFile(
              `${outputPath}.${profileName}.cpuprofile`,
              `${JSON.stringify(profile)}\n`,
            );
          }
        }
      }

      const report = {
        method:
          "Node process.cpuUsage around in-process H3 dispatch, including Request construction, mock-call bookkeeping, and response-body consumption; deterministic service-boundary mocks; representative and large fixtures; separate 1 ms V8 profiles for large fixtures",
        runtime: process.version,
        scope:
          "Comparative in-process proxy, not server-only CPU: includes Request construction, mock-call bookkeeping, real API handler work, H3 JSON serialization, and response-body consumption. MediaService, TMDB, and database dependencies return deterministic pre-shaped fixtures, so their internal transforms and all network/client decoding are excluded; full Nuxt page SSR and Cloudflare Workers runtime/accounting are also excluded.",
        workloads,
      };
      const outputPath = process.env.ROUTE_CPU_OUTPUT ?? "/tmp/route-cpu.json";
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`Route CPU report written to ${outputPath}`);

      expect(workloads).toHaveLength(12);
    }, 180_000);
  },
);
