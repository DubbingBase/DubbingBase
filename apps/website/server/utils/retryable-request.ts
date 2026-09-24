export class RetryableMediaRequestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RetryableMediaRequestError";
  }
}

export function isRetryableMediaRequestError(
  error: unknown,
): error is RetryableMediaRequestError {
  return error instanceof RetryableMediaRequestError;
}

export function isRetryableMediaRequestStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function createMediaResponseError(
  provider: string,
  response: Response,
): Error {
  const message = `${provider} API error: ${response.status} ${response.statusText}`;
  return isRetryableMediaRequestStatus(response.status)
    ? new RetryableMediaRequestError(message)
    : new Error(message);
}

export async function fetchMediaRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError"))
    ) {
      throw new RetryableMediaRequestError(error.message, { cause: error });
    }
    throw error;
  }
}
