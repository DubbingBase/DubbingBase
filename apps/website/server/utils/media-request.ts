import { createError } from "h3";
import { withTimeout } from "./with-timeout";

const MEDIA_SERVICE_TIMEOUT_MS = 12_000;

function parseInteger(value: unknown, name: string, minimum: number): number {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || raw.trim() === "") {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${name}` });
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${name}` });
  }

  return parsed;
}

export function parseSeasonQuery(query: Record<string, unknown>) {
  return {
    id: parseInteger(query.id, "id", 1),
    seasonNumber: parseInteger(query.season_number, "season_number", 0),
  };
}

export function parseEpisodeQuery(query: Record<string, unknown>) {
  return {
    ...parseSeasonQuery(query),
    episodeNumber: parseInteger(query.episode_number, "episode_number", 1),
  };
}

function statusCodeOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) {
    return undefined;
  }

  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}

function toMediaServiceError(error: unknown, dependency: string) {
  const statusCode = statusCodeOf(error);
  if (statusCode === 404 || statusCode === 504) return error;

  const message = error instanceof Error ? error.message : String(error);
  const upstreamStatus = /^TMDB API error:\s*(\d+)$/.exec(message)?.[1];
  if (upstreamStatus === "404") {
    return createError({
      statusCode: 404,
      statusMessage: `${dependency} not found`,
      cause: error,
    });
  }

  if (/timeout|timed out|aborterror/i.test(message)) {
    return createError({
      statusCode: 504,
      statusMessage: `${dependency} timed out`,
      cause: error,
    });
  }

  return createError({
    statusCode: 502,
    statusMessage: `${dependency} request failed`,
    cause: error,
  });
}

export async function withMediaServiceTimeout<T>(
  request: () => Promise<T>,
  dependency: string,
  timeoutMs = MEDIA_SERVICE_TIMEOUT_MS,
): Promise<T> {
  try {
    return await withTimeout(
      Promise.resolve().then(request),
      timeoutMs,
      dependency,
    );
  } catch (error: unknown) {
    throw toMediaServiceError(error, dependency);
  }
}
