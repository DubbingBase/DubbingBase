/**
 * Reads a user-facing message from an unknown thrown value.
 * Accepts Error instances and plain objects with a string `message`
 * (for example Supabase PostgrestError), and returns undefined otherwise.
 */
export function readErrorMessage(err: unknown): string | undefined {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return typeof err.message === "string" ? err.message : undefined;
  }
  return undefined;
}
