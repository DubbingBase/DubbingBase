export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error === null || error === undefined) return String(error);

  try {
    const serialized = JSON.stringify(error);
    if (serialized) return serialized;
  } catch {
    // Fall through for circular or otherwise non-serializable values.
  }

  if (typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string") return message;
    if (message !== null && message !== undefined) {
      return getErrorMessage(message);
    }
  }

  return String(error) === "[object Object]" ? "Unknown structured error" : String(error);
}
