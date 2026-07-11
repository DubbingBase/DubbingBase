import { describe, it, expect, vi } from "vitest";
import { ref, computed } from "vue";

// The router module eagerly imports Login.vue, AdminLayout.vue,
// Dashboard.vue and VoiceActorSpreadsheet.vue as well as "@/lib/auth"
// (which in turn imports the real Supabase client). Stub all of these out
// so the router's own configuration/guards can be tested in isolation,
// without needing real Supabase credentials or rendering those views.
vi.mock("../../views/Login.vue", () => ({ default: { name: "Login" } }));
vi.mock("../../components/AdminLayout.vue", () => ({
  default: { name: "AdminLayout" },
}));
vi.mock("../../views/Dashboard.vue", () => ({ default: { name: "Dashboard" } }));
vi.mock("../../views/VoiceActorSpreadsheet.vue", () => ({
  default: { name: "VoiceActorSpreadsheet" },
}));

vi.mock("@/lib/auth", () => ({
  user: ref(null),
  isAdmin: computed(() => false),
  isLoading: ref(false),
}));

describe("router beforeEnter guard for CreateVoiceActor", () => {
  async function getGuard() {
    const { default: router } = await import("../index");
    const route = router
      .getRoutes()
      .find((r) => r.name === "CreateVoiceActor");
    expect(route).toBeTruthy();
    expect(route?.beforeEnter).toBeTruthy();
    // beforeEnter can be a single guard or an array of guards depending on
    // how vue-router normalizes the route record; support both shapes.
    const guard = Array.isArray(route?.beforeEnter)
      ? route?.beforeEnter[0]
      : route?.beforeEnter;
    return guard as (to: unknown, from: unknown, next: (arg?: unknown) => void) => void;
  }

  it("allows navigation when coming from the VoiceActorSpreadsheet route by name", async () => {
    const guard = await getGuard();
    const next = vi.fn();

    guard({}, { name: "VoiceActorSpreadsheet", path: "/somewhere-else" }, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("allows navigation when coming from the /voice-actor-spreadsheet path", async () => {
    const guard = await getGuard();
    const next = vi.fn();

    guard({}, { name: undefined, path: "/voice-actor-spreadsheet" }, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("redirects to /voice-actor-spreadsheet when navigating from any other route", async () => {
    const guard = await getGuard();
    const next = vi.fn();

    guard({}, { name: "Dashboard", path: "/" }, next);

    expect(next).toHaveBeenCalledWith("/voice-actor-spreadsheet");
  });
});