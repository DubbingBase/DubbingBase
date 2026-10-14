import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { fetchRandomTask, useContribute } from "./useContribute";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
mockNuxtImport("$fetch", () => fetchMock);
const claimed = {
  task: { id: 1, firstname: "Actor", bio: null },
  category: "enrich_voice_actor",
  claimId: "opaque-claim",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe("contribution claims", () => {
  it("uses POST JSON and preserves the claim envelope", async () => {
    fetchMock.mockResolvedValue(claimed);
    expect(await fetchRandomTask("enrich_voice_actor")).toEqual(claimed);
    expect(fetchMock).toHaveBeenCalledWith("/api/get-random-task", {
      method: "POST",
      body: { category: "enrich_voice_actor" },
      retry: 0,
    });
  });

  it("does not claim on setup and handles the four-key no-task envelope", async () => {
    const state = useContribute();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue({
      task: null,
      category: "enrich_studio",
      claimId: null,
      expiresAt: null,
    });
    await state.getRandomTask("enrich_studio");
    expect(state.noTask.value).toBe(true);
    expect(state.activeCategory.value).toBe("enrich_studio");
    expect(state.error.value).toBeNull();
    expect(state.isLoading.value).toBe(false);
  });

  it("ignores a previous category response arriving late", async () => {
    let resolveOld: (value: typeof claimed) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<typeof claimed>((resolve) => {
        resolveOld = resolve;
      }),
    );
    fetchMock.mockResolvedValueOnce({
      ...claimed,
      category: "enrich_studio",
      claimId: "studio",
      task: { id: 2 },
    });
    const state = useContribute();
    const old = state.getRandomTask("enrich_voice_actor");
    await state.getRandomTask("enrich_studio");
    resolveOld(claimed);
    await old;
    expect(state.claimId.value).toBe("studio");
  });

  it("exposes authentication failure and settles loading", async () => {
    fetchMock.mockRejectedValue({ statusCode: 401 });
    const state = useContribute();
    await state.getRandomTask("any");
    expect(state.requiresLogin.value).toBe(true);
    expect(state.isLoading.value).toBe(false);
  });

  it("submits the claim and fields without client entity authority; prevents double submit", async () => {
    const state = useContribute();
    fetchMock.mockResolvedValueOnce(claimed);
    await state.getRandomTask("any");
    fetchMock.mockResolvedValueOnce({ success: true, pointsAwarded: 10 });
    const first = state.submitTask({ bio: "Biography" });
    expect(await state.submitTask({ bio: "Duplicate" })).toBeNull();
    expect(await first).toEqual({ success: true, pointsAwarded: 10 });
    const form: FormData = fetchMock.mock.calls[1]?.[1].body;
    expect([...form.keys()]).toEqual(["claimId", "bio"]);
    expect(form.get("claimId")).toBe("opaque-claim");
    expect(state.currentTask.value).toBeNull();
    expect(await state.submitTask({ bio: "Replay" })).toBeNull();
  });

  it("only sends studio fields and cannot override the claim ID", async () => {
    const state = useContribute();
    fetchMock.mockResolvedValueOnce({
      ...claimed,
      category: "enrich_studio",
      task: { id: 2, name: "Studio" },
    });
    await state.getRandomTask("enrich_studio");
    fetchMock.mockResolvedValueOnce({ success: true, pointsAwarded: 5 });
    const file = new File(["image"], "logo.png", { type: "image/png" });
    await state.submitTask({
      file,
      country: "France",
      bio: "not a studio field",
      claimId: "forged",
      entityId: "99",
      category: "enrich_voice_actor",
    });
    const form: FormData = fetchMock.mock.calls[1]?.[1].body;
    expect([...form.keys()]).toEqual(["claimId", "file", "country"]);
    expect(form.get("claimId")).toBe("opaque-claim");
    expect(form.get("file")).toBeInstanceOf(File);
  });

  it("keeps validation errors retryable and treats submit 401 as a login requirement", async () => {
    const state = useContribute();
    fetchMock.mockResolvedValueOnce(claimed);
    await state.getRandomTask("any");
    fetchMock.mockRejectedValueOnce({ statusCode: 400 });
    await state.submitTask({ bio: "Needs correction" });
    expect(state.currentTask.value?.id).toBe(1);
    expect(state.error.value).toContain("check");
    fetchMock.mockRejectedValueOnce({ statusCode: 401 });
    await state.submitTask({ bio: "Session expired" });
    expect(state.requiresLogin.value).toBe(true);
    expect(state.currentTask.value).toBeNull();
  });

  it("invalidates pending responses on reset", async () => {
    let resolveClaim: (value: typeof claimed) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<typeof claimed>((resolve) => {
        resolveClaim = resolve;
      }),
    );
    const state = useContribute();
    const pending = state.getRandomTask("any");
    expect(state.isLoading.value).toBe(true);
    state.reset();
    resolveClaim(claimed);
    await pending;
    expect(state.currentTask.value).toBeNull();
    expect(state.isLoading.value).toBe(false);
  });

  it("does not submit an already expired claim", async () => {
    const state = useContribute();
    fetchMock.mockResolvedValueOnce({
      ...claimed,
      expiresAt: "2000-01-01T00:00:00.000Z",
    });
    await state.getRandomTask("any");
    expect(await state.submitTask({ bio: "Too late" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.error.value).toContain("expired");
  });

  it("rejects incomplete claim envelopes instead of showing an unusable task", async () => {
    fetchMock.mockResolvedValue({
      task: claimed.task,
      category: "enrich_voice_actor",
    });
    const state = useContribute();
    await state.getRandomTask("any");
    expect(state.currentTask.value).toBeNull();
    expect(state.error.value).toBeTruthy();
  });

  it("keeps input task on network failure, but invalidates expired claims", async () => {
    const state = useContribute();
    fetchMock.mockResolvedValueOnce(claimed);
    await state.getRandomTask("any");
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await state.submitTask({ bio: "Retry me" })).toBeNull();
    expect(state.currentTask.value?.id).toBe(1);
    expect(state.error.value).toBeTruthy();
    fetchMock.mockRejectedValueOnce({ statusCode: 409 });
    await state.submitTask({ bio: "Expired" });
    expect(state.claimId.value).toBeNull();
    expect(state.isSubmitting.value).toBe(false);
  });
});
