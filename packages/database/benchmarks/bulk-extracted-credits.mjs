import { execFileSync } from "node:child_process";

const databaseDirectory = new URL("../", import.meta.url);
const output = execFileSync("pnpm", ["supabase", "status", "-o", "env"], {
  cwd: databaseDirectory,
  encoding: "utf8",
});
const environment = Object.fromEntries(
  [...output.matchAll(/^([A-Z_]+)="([^"]+)"$/gm)].map((match) => [
    match[1],
    match[2],
  ]),
);
const apiUrl = environment.API_URL;
const serviceKey = environment.SERVICE_ROLE_KEY;
if (
  !apiUrl ||
  !serviceKey ||
  !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(apiUrl)
) {
  throw new Error("Benchmark requires a running local Supabase backend.");
}

const batchSize = Number(process.env.BENCH_CREDITS ?? 10);
const repetitions = Number(process.env.BENCH_REPETITIONS ?? 3);
const median = (values) =>
  [...values].sort((left, right) => left - right)[
    Math.floor(values.length / 2)
  ];
const runId = Math.floor(Date.now() / 1000);
const firstName = `Bench${runId}`;
const contentId = 9_000_000_000_000 + runId;
const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
  "content-type": "application/json",
};

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  const body = await response.text();
  if (!response.ok)
    throw new Error(
      `Local benchmark request failed (${response.status}): ${body}`,
    );
  return body ? JSON.parse(body) : null;
}

const credits = Array.from({ length: batchSize }, (_, index) => ({
  firstname: firstName,
  lastname: `Actor${index}`,
  actor_id: 700_000_000 + index,
  performance: "benchmark",
  character_id: null,
  character_name: null,
}));

async function oldPath() {
  for (let index = 0; index < batchSize; index += 1) {
    const credit = credits[index];
    const actorQuery = new URLSearchParams({
      select: "id",
      firstname: `eq.${credit.firstname}`,
      lastname: `eq.${credit.lastname}`,
    });
    const actors = await request(`voice_actors?${actorQuery}`);
    const projectQuery = new URLSearchParams({
      select: "id",
      content_id: `eq.${contentId}`,
      content_type: "eq.movie",
      language: "eq.fr-FR",
    });
    await request(`dubbing_projects?${projectQuery}`);
    const workQuery = new URLSearchParams({
      select: "id",
      dubbing_project_id: `eq.${projectId}`,
      voice_actor_id: `eq.${actors[0].id}`,
      actor_id: `eq.${credit.actor_id}`,
    });
    const works = await request(`work?${workQuery}`);
    await request(`work?id=eq.${works[0].id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ performance: "benchmark" }),
    });
  }
}

async function bulkPath() {
  const result = await request("rpc/apply_extracted_credits", {
    method: "POST",
    body: JSON.stringify({
      p_content_id: contentId,
      p_content_type: "movie",
      p_dubbing_language: "fr-FR",
      p_credits: credits,
    }),
  });
  if (result.credits_added !== batchSize) {
    throw new Error(
      `Bulk RPC returned an unexpected credit count: ${JSON.stringify(result)}`,
    );
  }
}

let projectId;
let voiceActorIds = [];
try {
  const projects = await request("dubbing_projects", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      content_id: contentId,
      content_type: "movie",
      language: "fr-FR",
    }),
  });
  projectId = projects[0].id;
  const actors = await request("voice_actors", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(
      credits.map((credit) => ({
        firstname: credit.firstname,
        lastname: credit.lastname,
      })),
    ),
  });
  voiceActorIds = actors.map((actor) => actor.id);
  await request("work", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(
      credits.map((credit, index) => ({
        dubbing_project_id: projectId,
        voice_actor_id: voiceActorIds[index],
        actor_id: credit.actor_id,
        character_id: null,
        performance: "benchmark",
        status: "suggestion",
      })),
    ),
  });

  const before = [];
  const after = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    let start = performance.now();
    await oldPath();
    before.push(performance.now() - start);

    start = performance.now();
    await bulkPath();
    after.push(performance.now() - start);
  }

  console.log(
    JSON.stringify({
      environment: "local Supabase only",
      batchSize,
      repetitions,
      oldPathRequestsPerBatch: batchSize * 4,
      bulkPathRequestsPerBatch: 1,
      oldPathMedianMs: median(before),
      bulkPathMedianMs: median(after),
      elapsedReductionPercent: Math.round(
        (1 - median(after) / median(before)) * 100,
      ),
    }),
  );
} finally {
  if (projectId) {
    await request(`work?dubbing_project_id=eq.${projectId}`, {
      method: "DELETE",
    });
    await request(`dubbing_projects?id=eq.${projectId}`, { method: "DELETE" });
  }
  if (voiceActorIds.length > 0) {
    await request(`voice_actors?id=in.(${voiceActorIds.join(",")})`, {
      method: "DELETE",
    });
  }
}
