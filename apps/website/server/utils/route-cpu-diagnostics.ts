const ROUTE_CPU_SAMPLE_RATE = 1;
// Remove this temporary diagnostic after investigation or when it expires.
const ROUTE_CPU_DIAGNOSTICS_EXPIRES_AT = Date.parse("2026-10-23T00:00:00Z");

const PAGE_FAMILIES = new Set([
  "movie",
  "show",
  "actor",
  "voice-actor",
  "game",
  "podcast",
  "audiobook",
  "advertisement",
  "toy",
  "search",
]);

const API_FAMILIES = new Set([
  "movie",
  "show",
  "actor",
  "voice-actor",
  "game",
  "podcast",
  "audiobook",
  "advertisement",
  "toy",
  "search",
  "trending",
  "admin",
  "career-grid",
  "detail-collections",
  "episode",
  "season",
]);

const LOCALE_PREFIXES = new Set(["fr", "es", "ja"]);

export interface RouteCpuSample {
  event: "route_cpu_sample";
  routeFamily: string;
  method: "GET" | "OTHER";
  sampleRate: 1;
}

export function routeCpuFamily(pathname: string): string {
  const segments = new URL(pathname, "https://route-diagnostic.invalid").pathname
    .split("/")
    .filter(Boolean);

  if (LOCALE_PREFIXES.has(segments[0] ?? "")) segments.shift();

  if (segments.length === 0) return "page:home";
  if (segments[0] === "_nuxt") return "asset:nuxt";

  if (segments[0] === "api") {
    const family = segments[1] ?? "";
    return API_FAMILIES.has(family) ? `api:${family}` : "api:other";
  }

  const family = segments[0] ?? "";
  return PAGE_FAMILIES.has(family) ? `page:${family}` : "page:other";
}

export function createRouteCpuSample(
  pathname: string,
  method: string,
  now = Date.now(),
  random?: number,
): RouteCpuSample | null {
  if (now >= ROUTE_CPU_DIAGNOSTICS_EXPIRES_AT) return null;
  if ((random ?? Math.random()) >= ROUTE_CPU_SAMPLE_RATE) {
    return null;
  }

  return {
    event: "route_cpu_sample",
    routeFamily: routeCpuFamily(pathname),
    method: method === "GET" ? "GET" : "OTHER",
    sampleRate: ROUTE_CPU_SAMPLE_RATE,
  };
}
