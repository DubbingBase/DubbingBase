import { readPath } from "@app/shared-logic";

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
    return !!readPath(data, "featureFlags", "enqueue-on-navigate");
  } catch {
    return false;
  }
}
