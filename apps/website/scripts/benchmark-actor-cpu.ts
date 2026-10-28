/**
 * Local-only profile of the actor page's real payload projection, composable,
 * and card render helpers. Fixtures replace upstream data; setup stays outside
 * the measured loops.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { Session } from "node:inspector";
import { effectScope, ref } from "vue";
import type {
  ActorDataPayload,
  ActorResponse,
} from "../../../packages/shared-logic/src/composables/useActorData.ts";
import { useActorData } from "../../../packages/shared-logic/src/composables/useActorData.ts";
import {
  renderActorFilmographyCardHtml,
  renderActorVoiceActorCardHtml,
} from "../src/utils/actor-grid-html.ts";
import { prepareActorSsrData } from "../src/utils/actor-ssr-data.ts";
import {
  actorPageResponse,
  type ActorPageVoiceRole,
} from "../server/utils/actor-page-response.ts";

interface Workload {
  name: "representative" | "large";
  credits: number;
  voiceRoles: number;
  voiceActors: number;
  dubbingProjects: number;
  metadataItems: number;
  iterations: number;
  warmupIterations: number;
}

interface ActorWorkloadFixture {
  payload: ActorDataPayload;
  apiActor: Record<string, unknown>;
  apiCredits: Record<string, unknown>[];
  apiVoiceRoles: ActorPageVoiceRole[];
}

interface CpuProfileNode {
  id: number;
  callFrame: {
    functionName: string;
    url: string;
    lineNumber: number;
  };
  children?: number[];
}

interface CpuProfile {
  nodes: CpuProfileNode[];
  samples?: number[];
  timeDeltas?: number[];
}

interface ProfileHotFunction {
  function: string;
  selfMicroseconds: number;
  totalMicroseconds: number;
}

const workloads: Record<Workload["name"], Workload> = {
  representative: {
    name: "representative",
    credits: 12,
    voiceRoles: 24,
    voiceActors: 18,
    dubbingProjects: 20,
    metadataItems: 12,
    warmupIterations: 500,
    iterations: 6000,
  },
  large: {
    name: "large",
    credits: 1200,
    voiceRoles: 500,
    voiceActors: 180,
    dubbingProjects: 400,
    metadataItems: 1200,
    warmupIterations: 100,
    iterations: 1200,
  },
};

function makeWorkload(workload: Workload): ActorWorkloadFixture {
  const voiceActors = Array.from(
    { length: workload.voiceActors },
    (_, index) => ({
      id: index + 1,
      firstname: `Voice${index + 1}`,
      lastname: `Actor${index + 1}`,
      profile_picture: index % 5 === 0 ? null : `voice-${index + 1}.jpg`,
    }),
  );
  const voiceRoles: ActorPageVoiceRole[] = Array.from(
    { length: workload.voiceRoles },
    (_, index) => {
      const contentId = (index % workload.dubbingProjects) + 1;
      const voiceActor = voiceActors[index % voiceActors.length];
      return {
        id: index + 1,
        performance: `Character ${index + 1}`,
        dubbing_projects: {
          language: index % 4 === 0 ? "fr-FR" : `lang-${index % 7}`,
          content_id: contentId,
        },
        voice_actors: voiceActor ? [{ ...voiceActor }] : [],
      };
    },
  );
  const credits: ActorResponse["actor"]["credits"]["cast"] = Array.from(
    { length: workload.credits },
    (_, index) => ({
      id: (index % workload.metadataItems) + 1,
      title: `Film ${index + 1}`,
      character: `Character ${index + 1}`,
      poster_path: `/poster-${index + 1}.jpg`,
      release_date: `20${String(10 + (index % 15)).padStart(2, "0")}-01-01`,
      media_type: index % 2 === 0 ? "movie" : "tv",
    }),
  );

  const actor = {
    id: 6384,
    name: "Benchmark Actor",
    biography:
      "A deterministic profile used only by the local actor CPU benchmark.",
    birthday: "1970-01-01",
    deathday: null,
    place_of_birth: "Example City",
    profile_path: "/profile.jpg",
    known_for_department: "Acting",
    credits: { cast: credits },
    voice_roles: voiceRoles,
  };
  const payload: ActorDataPayload = {
    actor,
    voiceRoles,
    ...(workload.name === "representative" ? { filmographyCount: 640 } : {}),
  };

  return {
    payload,
    apiActor: Object.fromEntries(Object.entries(actor)),
    apiCredits: credits.map((credit) =>
      Object.fromEntries(Object.entries(credit)),
    ),
    apiVoiceRoles: voiceRoles,
  };
}

function runActorPath(fixture: ActorWorkloadFixture): number {
  const { payload } = fixture;
  const scope = effectScope();
  let htmlBytes = 0;

  scope.run(() => {
    const data = useActorData(payload, {
      filmographyPagination: ref({ page: 1, pageSize: 12 }),
    });
    const pageResponse = actorPageResponse(
      fixture.apiActor,
      fixture.apiCredits,
      fixture.apiVoiceRoles,
      payload.actor?.profile_path ?? null,
      payload.filmographyCount === undefined
        ? undefined
        : { filmographyCount: payload.filmographyCount },
    );

    const voiceActorCards = data.filteredUniqueVoiceActorsByLanguage.value
      .slice(0, 12)
      .map((voiceActor) =>
        renderActorVoiceActorCardHtml(
          voiceActor,
          `/voice-actor/${voiceActor.id}`,
          " roles",
          (src, alt, imageClass) => ({
            "data-nuxt-img": "",
            alt,
            class: imageClass,
            decoding: "async",
            loading: "lazy",
            src: `https://images.example.test/${src ?? ""}`,
          }),
        ),
      );
    const filmographyCards = data.enhancedFilmography.value
      .slice(0, 12)
      .map((item) =>
        renderActorFilmographyCardHtml(
          item,
          `/movie/${item.id}`,
          item.voice_actors?.[0]
            ? `/voice-actor/${item.voice_actors[0].id}`
            : undefined,
          { voicedBy: "Voiced by", as: "As", unknownCharacter: "Unknown" },
          (src, alt, imageClass) => ({
            "data-nuxt-img": "",
            alt,
            class: imageClass,
            decoding: "async",
            loading: "lazy",
            src: `https://images.example.test/${src ?? ""}`,
          }),
          (path) => (path ? `https://images.example.test${path}` : undefined),
        ),
      );

    htmlBytes =
      voiceActorCards.reduce((length, html) => length + html.length, 0) +
      filmographyCards.reduce((length, html) => length + html.length, 0);

    if (
      data.availableLanguages.value.length === 0 ||
      voiceActorCards.length === 0 ||
      filmographyCards.length !==
        Math.min(12, payload.actor?.credits.cast.length ?? 0) ||
      !voiceActorCards[0]?.includes("Voice") ||
      !filmographyCards[0]?.includes("Film 1") ||
      pageResponse.actor.name !== payload.actor?.name ||
      pageResponse.actor.credits.cast.length !==
        payload.actor?.credits.cast.length ||
      pageResponse.actor.voice_roles.length !== payload.voiceRoles.length ||
      pageResponse.filmographyCount !== payload.filmographyCount ||
      htmlBytes === 0
    ) {
      throw new Error("Actor workload output did not match its expected shape");
    }
  });

  scope.stop();
  return htmlBytes;
}

function profileWorkload(
  workload: Workload,
  fixture: ActorWorkloadFixture,
): Promise<{
  profilePath: string;
  htmlBytes: number;
  hotFunctions: ProfileHotFunction[];
}> {
  return new Promise((resolve, reject) => {
    const session = new Session();
    session.connect();
    session.post("Profiler.enable", (enableError) => {
      if (enableError) {
        session.disconnect();
        reject(enableError);
        return;
      }
      session.post("Profiler.start", (startError) => {
        if (startError) {
          session.disconnect();
          reject(startError);
          return;
        }

        let htmlBytes = 0;
        for (
          let iteration = 0;
          iteration < workload.iterations;
          iteration += 1
        ) {
          htmlBytes += runActorPath(fixture);
        }

        session.post("Profiler.stop", (stopError, result) => {
          session.disconnect();
          if (stopError) {
            reject(stopError);
            return;
          }
          const profile = result.profile as CpuProfile;
          const profilePath = `/tmp/actor-${workload.name}-${process.pid}.cpuprofile`;
          writeFileSync(profilePath, JSON.stringify(profile));
          resolve({
            profilePath,
            htmlBytes,
            hotFunctions: rankHotFunctions(profile),
          });
        });
      });
    });
  });
}

function rankHotFunctions(profile: CpuProfile): ProfileHotFunction[] {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map<number, number>();
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) parents.set(child, node.id);
  }

  const counts = new Map<string, ProfileHotFunction>();
  for (const [sampleIndex, sample] of (profile.samples ?? []).entries()) {
    const elapsed = profile.timeDeltas?.[sampleIndex] ?? 0;
    let nodeId: number | undefined = sample;
    let isSelf = true;
    while (nodeId !== undefined) {
      const node = nodes.get(nodeId);
      if (!node) break;
      const { functionName, url, lineNumber } = node.callFrame;
      const isGarbageCollection = functionName === "(garbage collector)";
      if (
        !url.includes("/benchmark-actor-cpu.ts") &&
        !url.startsWith("node:") &&
        (url !== "" || isGarbageCollection)
      ) {
        const frame = isGarbageCollection
          ? "(garbage collector) — V8"
          : `${functionName || "(anonymous)"} — ${url}:${lineNumber + 1}`;
        const count = counts.get(frame) ?? {
          function: frame,
          selfMicroseconds: 0,
          totalMicroseconds: 0,
        };
        if (isSelf) count.selfMicroseconds += elapsed;
        count.totalMicroseconds += elapsed;
        counts.set(frame, count);
      }
      nodeId = parents.get(nodeId);
      isSelf = false;
    }
  }

  return [...counts.values()]
    .sort((left, right) => right.totalMicroseconds - left.totalMicroseconds)
    .slice(0, 20);
}

function percentile(sorted: number[], quantile: number): number {
  return (
    sorted[
      Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)
    ] ?? 0
  );
}

async function main(): Promise<void> {
  const name = process.argv[2];
  if (name !== "representative" && name !== "large") {
    throw new Error(
      "Usage: node --experimental-strip-types apps/website/scripts/benchmark-actor-cpu.ts <representative|large>",
    );
  }

  const workload = workloads[name];
  const fixture = makeWorkload(workload);
  prepareActorSsrData(fixture.payload);

  for (
    let iteration = 0;
    iteration < workload.warmupIterations;
    iteration += 1
  ) {
    runActorPath(fixture);
  }

  const timings: number[] = [];
  let htmlBytes = 0;
  const timingCpuStarted = process.cpuUsage();
  for (let iteration = 0; iteration < workload.iterations; iteration += 1) {
    const started = performance.now();
    htmlBytes += runActorPath(fixture);
    timings.push((performance.now() - started) * 1000);
  }
  const timingLoopUserCpuMicroseconds = process.cpuUsage(timingCpuStarted).user;

  const profileResult = await profileWorkload(workload, fixture);
  const {
    profilePath,
    htmlBytes: profiledHtmlBytes,
    hotFunctions,
  } = profileResult;
  timings.sort((left, right) => left - right);
  const profile = JSON.parse(readFileSync(profilePath, "utf8")) as CpuProfile;
  const profileNodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const garbageCollectorIndices = (profile.samples ?? []).flatMap(
    (sample, index) =>
      profileNodes.get(sample)?.callFrame.functionName === "(garbage collector)"
        ? [index]
        : [],
  );

  process.stdout.write(
    `${JSON.stringify({
      workload: workload.name,
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
      cpu: cpus()[0]?.model,
      inputs: {
        credits: workload.credits,
        voiceRoles: workload.voiceRoles,
        voiceActors: workload.voiceActors,
        dubbingProjects: workload.dubbingProjects,
        metadataItems: workload.metadataItems,
      },
      warmupIterations: workload.warmupIterations,
      iterations: workload.iterations,
      measuredInvocations: workload.iterations,
      medianWallMicroseconds: percentile(timings, 0.5),
      p95WallMicroseconds: percentile(timings, 0.95),
      unprofiledLoopUserCpuMicroseconds: timingLoopUserCpuMicroseconds,
      meanUserCpuMicrosecondsPerInvocation:
        timingLoopUserCpuMicroseconds / workload.iterations,
      profileSamples: profile.samples?.length ?? 0,
      profileDurationMicroseconds: profile.timeDeltas?.reduce(
        (total, delta) => total + delta,
        0,
      ),
      garbageCollectorSamples: garbageCollectorIndices.length,
      garbageCollectorMicroseconds: garbageCollectorIndices.reduce(
        (total, index) => total + (profile.timeDeltas?.[index] ?? 0),
        0,
      ),
      renderedHtmlBytesPerInvocation: Math.floor(
        htmlBytes / workload.iterations,
      ),
      profileRenderedHtmlBytesPerInvocation: Math.floor(
        profiledHtmlBytes / workload.iterations,
      ),
      profilePath,
      hottestProfileFrames: hotFunctions,
      profileIsLocalOnly: true,
    })}\n`,
  );
}

await main();
