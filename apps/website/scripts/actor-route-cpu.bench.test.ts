import {
  createApp,
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  getRouterParam,
  toWebHandler,
} from "h3";
import inspector from "node:inspector";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPersonWithCredits: vi.fn(),
  getActorPageWorkByActor: vi.fn(),
  getWorkByActor: vi.fn(),
}));

vi.mock("../server/utils/index", () => ({ useTmdbClient: () => mocks }));
vi.mock("../server/utils/db/queries", () => ({
  getActorPageWorkByActor: mocks.getActorPageWorkByActor,
  getWorkByActor: mocks.getWorkByActor,
}));

type ActorHandler = typeof import("../server/api/actor/[id].get").default;

type Fixture = {
  creditCount: number;
  roleCount: number;
  actor: Record<string, unknown>;
  roles: Array<Record<string, unknown>>;
};

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

let handler: ActorHandler;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getRouterParam", getRouterParam);
  vi.stubGlobal("getHeader", getHeader);
  vi.stubGlobal("getQuery", getQuery);
  vi.stubGlobal("createError", createError);
  handler = (await import("../server/api/actor/[id].get")).default;
});

afterAll(() => vi.unstubAllGlobals());

function makeFixture(creditCount: number, roleCount: number): Fixture {
  const movieCreditCount = Math.floor(creditCount * 0.7);
  const movieCredits = Array.from({ length: movieCreditCount }, (_, index) => ({
    id: index + 1,
    title: `Movie ${index + 1}`,
    character: `Role ${index + 1}`,
    poster_path: "/movie.png",
    release_date: "2020-01-01",
  }));
  const tvCredits = Array.from(
    { length: creditCount - movieCreditCount },
    (_, index) => ({
      id: movieCreditCount + index + 1,
      name: `Show ${index + 1}`,
      character: `Guest ${index + 1}`,
      poster_path: "/show.png",
      first_air_date: "2021-01-01",
    }),
  );
  const roles = Array.from({ length: roleCount }, (_, index) => ({
    id: index + 1,
    performance: `Performance ${index + 1}`,
    suggestions: "unused by actor page projection",
    dubbing_projects: {
      id: index + 1,
      content_id: index + 1,
      content_type: "movie",
      language: "fr-FR",
    },
    voice_actors: {
      id: index + 1,
      firstname: `Voice ${index + 1}`,
      lastname: "Actor",
      profile_picture: null,
      bio: "unused by actor page projection",
    },
  }));

  return {
    creditCount,
    roleCount,
    actor: {
      id: 6384,
      name: "Benchmark Actor",
      biography: "Deterministic benchmark fixture",
      profile_path: "/actor.png",
      movie_credits: { cast: movieCredits, crew: [] },
      tv_credits: { cast: tvCredits, crew: [] },
    },
    roles,
  };
}

function makeRequest(fixture: Fixture) {
  mocks.getPersonWithCredits.mockResolvedValue(fixture.actor);
  mocks.getActorPageWorkByActor.mockResolvedValue(fixture.roles);

  const app = createApp();
  app.use(
    defineEventHandler((event) => {
      event.context.params = { id: "6384" };
      return handler(event);
    }),
  );
  const fetch = toWebHandler(app);
  const url =
    "http://localhost/api/actor/6384?projection=actor-page&filmographyPage=1";

  async function request() {
    const response = await fetch(new Request(url));
    if (response.status !== 200) {
      throw new Error(`Actor API returned HTTP ${response.status}.`);
    }
    return response;
  }

  return {
    async invoke() {
      const response = await request();
      return (await response.arrayBuffer()).byteLength;
    },
    async verify() {
      const response = await request();
      const body: unknown = await response.json();
      if (!isRecord(body) || !isRecord(body.actor)) {
        throw new Error("Actor API returned an invalid page projection.");
      }
      const actor = body.actor;
      const credits = actor.credits;
      const voiceRoles = actor.voice_roles;
      if (
        !isRecord(credits) ||
        !Array.isArray(credits.cast) ||
        !Array.isArray(voiceRoles)
      ) {
        throw new Error(
          "Actor API projection is missing credits or voice roles.",
        );
      }
      expect(body.filmographyCount).toBe(fixture.creditCount);
      expect(actor.name).toBe("Benchmark Actor");
      expect(credits.cast).toHaveLength(12);
      expect(voiceRoles).toHaveLength(fixture.roleCount);
      expect(mocks.getActorPageWorkByActor).toHaveBeenCalled();
    },
  };
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
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function summarize(values: number[]) {
  return {
    median: median(values),
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCpuProfile(value: unknown): value is CpuProfile {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.samples))
    return false;
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

async function captureCpuProfile(
  invoke: () => Promise<number>,
  requestCount: number,
) {
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
    const isServerFrame =
      source.startsWith("server/") || source.startsWith("apps/website/server/");
    if (
      !isServerFrame &&
      !source.includes("/h3@") &&
      !source.includes("/node_modules/h3/")
    ) {
      continue;
    }

    relevantSampleCount += 1;
    const h3PackageMarker = "/node_modules/h3/";
    const h3PackageIndex = source.lastIndexOf(h3PackageMarker);
    const frameSource =
      h3PackageIndex >= 0
        ? `h3/${source.slice(h3PackageIndex + h3PackageMarker.length)}`
        : source;
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
      .slice(0, 10)
      .map((frame) => ({
        ...frame,
        sampleSharePercent:
          totalSampledMicros > 0
            ? (frame.sampledMicros / totalSampledMicros) * 100
            : 0,
      })),
  };
}

describe.skipIf(process.env.ACTOR_ROUTE_CPU_BENCHMARK !== "true")(
  "actor API synthetic CPU measurement",
  () => {
    it("writes warmed, unprofiled request CPU and a separate V8 profile", async () => {
      const workloadDefinitions: Array<{
        name: string;
        credits: number;
        roles: number;
      }> = [
        { name: "representative", credits: 640, roles: 24 },
        { name: "large", credits: 1200, roles: 500 },
      ];
      const warmupRequests = 20;
      const measuredRounds = 5;
      const requestsPerRound = 50;
      const profileRequests = 500;
      const workloads: unknown[] = [];
      let capturedProfile: CpuProfile | undefined;

      for (const definition of workloadDefinitions) {
        const fixture = makeFixture(definition.credits, definition.roles);
        const request = makeRequest(fixture);
        await request.verify();

        for (let index = 0; index < warmupRequests; index += 1) {
          await request.invoke();
        }

        const rounds: Array<Awaited<ReturnType<typeof runBatch>>> = [];
        for (let round = 0; round < measuredRounds; round += 1) {
          rounds.push(await runBatch(request.invoke, requestsPerRound));
        }
        const profile =
          definition.name === "large"
            ? await captureCpuProfile(request.invoke, profileRequests)
            : undefined;
        if (profile) capturedProfile = profile;

        workloads.push({
          name: definition.name,
          creditCount: fixture.creditCount,
          roleCount: fixture.roleCount,
          returnedCreditsPerRequest: 12,
          warmupRequests,
          measuredRounds,
          requestsPerRound,
          cpuMicrosPerRequest: {
            user: summarize(rounds.map((round) => round.userMicrosPerRequest)),
            system: summarize(
              rounds.map((round) => round.systemMicrosPerRequest),
            ),
            total: summarize(
              rounds.map((round) => round.totalMicrosPerRequest),
            ),
          },
          responseBytesPerRequest: summarize(
            rounds.map((round) => round.responseBytesPerRequest),
          ),
          ...(profile
            ? {
                profile: {
                  requestCount: profileRequests,
                  frameScope:
                    "actor server code and H3 frames; excludes Node, Vitest, benchmark, and inspector frames",
                  ...profileHotFrames(profile),
                },
              }
            : {}),
        });
      }

      const report = {
        method:
          "Node process.cpuUsage around serial H3 actor API requests; separate V8 sampling pass",
        runtime: process.version,
        handler: "apps/website/server/api/actor/[id].get.ts",
        upstreams:
          "TMDB actor data and Supabase voice-role rows use deterministic in-memory fixtures",
        workloads,
      };
      const outputPath =
        process.env.ACTOR_ROUTE_CPU_OUTPUT ?? "/tmp/actor-route-cpu.json";
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
      if (capturedProfile) {
        await writeFile(
          `${outputPath}.cpuprofile`,
          `${JSON.stringify(capturedProfile)}\n`,
        );
      }
      console.log(`Actor API CPU report written to ${outputPath}`);

      expect(workloads).toHaveLength(2);
    }, 120_000);
  },
);
