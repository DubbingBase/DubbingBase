/** An error that the public API renders as `{ error: { code, message } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
    /** Extra machine-readable fields rendered inside `error`, e.g. the matches of a duplicate. */
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}
