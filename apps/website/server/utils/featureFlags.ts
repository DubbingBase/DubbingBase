// Server-side PostHog flag 'enqueue-on-navigate' - plain fetch, no dep
export async function isEnqueueOnNavigateEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`https://n.dubbingbase.com/decide?v=3`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: "phc_me2esmRfMkokDSbTzKQfNHaUZgpBOAqgi2921wCYOtP",
        distinct_id: "server-enqueue-check",
        groups: {},
      }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data: unknown = await res.json();
    const flags =
      typeof data === "object" && data !== null ? Reflect.get(data, "featureFlags") : undefined;
    return typeof flags === "object" && flags !== null
      ? !!Reflect.get(flags, "enqueue-on-navigate")
      : false;
  } catch {
    return false;
  }
}
