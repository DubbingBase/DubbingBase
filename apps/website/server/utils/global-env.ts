function readChild(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

/** Keeps only the string entries of an untyped env-like object (empty when not an object). */
export function toStringRecord(value: unknown): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  if (typeof value !== "object" || value === null) return out;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

/** Env injected on `globalThis.__env__` by some runtimes. */
export function getGlobalEnv(): Record<string, string | undefined> {
  return toStringRecord(Reflect.get(globalThis, "__env__"));
}

/** Env exposed at `event.context.cloudflare.env` on Cloudflare Workers. */
export function getCloudflareEnv(
  event: { context?: unknown } | undefined,
): Record<string, string | undefined> {
  return toStringRecord(readChild(readChild(event?.context, "cloudflare"), "env"));
}
