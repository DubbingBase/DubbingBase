import { describe, expect, it } from "vitest";
import { createRouteCpuSample, routeCpuFamily } from "./route-cpu-diagnostics";

describe("route CPU diagnostics", () => {
  it("groups localized detail pages without retaining their IDs or query strings", () => {
    expect(routeCpuFamily("/fr/movie/12345?private=value")).toBe("page:movie");
    expect(routeCpuFamily("/show/slug-with-user-data?x=1")).toBe("page:show");
    expect(routeCpuFamily("/ja/actor/123")).toBe("page:actor");
  });

  it("groups known APIs and collapses unknown paths to a fixed family", () => {
    expect(routeCpuFamily("/api/movie/12345")).toBe("api:movie");
    expect(routeCpuFamily("/api/trending/shows")).toBe("api:trending");
    expect(routeCpuFamily("/api/arbitrary-user-value/secret")).toBe("api:other");
    expect(routeCpuFamily("/arbitrary-user-value/secret")).toBe("page:other");
  });

  it("emits sanitized route markers for every request during bounded capture", () => {
    expect(
      createRouteCpuSample(
        "/movie/12345?token=private",
        "GET",
        Date.parse("2026-10-16T12:00:00Z"),
        0.999,
      ),
    ).toEqual({
      event: "route_cpu_sample",
      routeFamily: "page:movie",
      method: "GET",
      sampleRate: 1,
    });

    expect(
      createRouteCpuSample("/movie/12345", "POST", Date.parse("2026-10-16T12:00:00Z"), 1),
    ).toBeNull();
  });

  it("stops sampling after the fixed diagnostic expiry", () => {
    expect(
      createRouteCpuSample("/movie/12345", "GET", Date.parse("2026-10-23T00:00:00Z"), 0),
    ).toBeNull();
  });
});
