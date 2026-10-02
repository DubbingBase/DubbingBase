export class RetryableMediaRequestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RetryableMediaRequestError";
  }
}

export function isRetryableMediaRequestError(error: unknown): error is RetryableMediaRequestError {
  return error instanceof RetryableMediaRequestError;
}

export function isRetryableMediaRequestStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function createMediaResponseError(provider: string, response: Response): Error {
  const message = `${provider} API error: ${response.status} ${response.statusText}`;
  return isRetryableMediaRequestStatus(response.status)
    ? new RetryableMediaRequestError(message)
    : new Error(message);
}

/** Temporary, low-cardinality request-volume signal for the cache-removal measurement. */
export async function observeProviderRequest<T>(
  provider: string,
  request: () => Promise<T>,
): Promise<T> {
  let outcome: "response" | "error" = "response";
  try {
    return await request();
  } catch (error) {
    outcome = "error";
    throw error;
  } finally {
    try {
      console.info({ event: "provider_request", provider, outcome });
    } catch {
      // Temporary diagnostics must not change request behavior.
    }
  }
}

function providerForRequest(input: RequestInfo | URL): string | undefined {
  try {
    const hostname = new URL(input instanceof Request ? input.url : input.toString()).hostname;
    if (hostname === "api.themoviedb.org") return "tmdb";
    if (hostname === "api.thetvdb.com") return "tvdb";
    if (hostname === "api.igdb.com" || hostname === "id.twitch.tv") return "igdb";
    if (hostname === "openlibrary.org" || hostname.endsWith(".openlibrary.org")) {
      return "openlibrary";
    }
    if (hostname === "wikidata.org" || hostname.endsWith(".wikidata.org")) {
      return "wikidata";
    }
    if (hostname.endsWith(".wikipedia.org")) return "wikipedia";
  } catch {
    return undefined;
  }
  return undefined;
}

export async function fetchMediaRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const provider = providerForRequest(input);
  try {
    const request = () => fetch(input, init);
    return await (provider ? observeProviderRequest(provider, request) : request());
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
    ) {
      throw new RetryableMediaRequestError(error.message, { cause: error });
    }
    throw error;
  }
}
