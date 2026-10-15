import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { createSSRApp, nextTick, ref } from "vue";
import { renderToString } from "vue/server-renderer";
import { useNuxtApp } from "#app";
import Play from "./play.vue";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), navigate: vi.fn() }));
const user = ref<{ id: string } | null>({ id: "user-1" });
mockNuxtImport("$fetch", () => mocks.fetch);
mockNuxtImport("useI18n", () => () => ({ t: (key: string) => key }));
mockNuxtImport("useSupabaseUser", () => () => user);
mockNuxtImport("navigateTo", () => mocks.navigate);
mockNuxtImport("useLocalePath", () => () => (path: string) => path);

const claimed = {
  task: { id: 1, firstname: "Ada", lastname: "Actor", bio: null },
  category: "enrich_voice_actor",
  claimId: "claim-1",
  expiresAt: "2099-01-01T00:00:00.000Z",
};
const mounted: Array<{ unmount: () => void }> = [];
const mountPage = async (route = "/contribute/task/play") => {
  const wrapper = await mountSuspended(Play, {
    route,
    global: { mocks: { $t: (key: string) => key } },
  });
  mounted.push(wrapper);
  await flushPromises();
  return wrapper;
};

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.navigate.mockReset();
  user.value = { id: "user-1" };
});
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
});

describe("contribution page", () => {
  it("renders SSR loading without acquiring a claim", async () => {
    const app = createSSRApp(Play);
    app.config.globalProperties.$t = (key: string) => key;
    const html = await useNuxtApp().runWithContext(() => renderToString(app));
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(html).toContain('role="status"');
    expect(html).toContain("contribute.findingTask");
  });

  it("sends anonymous visitors to login with their category preserved and does not claim", async () => {
    user.value = null;
    await mountPage("/contribute/task/play?category=enrich_studio");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith({
      path: "/login",
      query: { redirect: "/contribute/task/play?category=enrich_studio" },
    });
  });

  it("claims once after mounting, displays no-task and offers retry", async () => {
    mocks.fetch.mockResolvedValue({
      task: null,
      category: "enrich_studio",
      claimId: null,
      expiresAt: null,
    });
    const wrapper = await mountPage();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("contribute.noTasksAvailable");
    expect(wrapper.get('option[value="any"]').text()).toBe("contribute.categoryAll");
    expect(wrapper.get('option[value="enrich_voice_actor"]').text()).toBe(
      "contribute.categoryVoiceActors",
    );
    expect(wrapper.get('option[value="enrich_studio"]').text()).toBe("contribute.categoryStudios");
    await wrapper.get('[data-test="retry-task"]').trigger("click");
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("resets input when changing category and posts that category", async () => {
    mocks.fetch.mockResolvedValueOnce(claimed);
    mocks.fetch.mockResolvedValueOnce({
      ...claimed,
      category: "enrich_studio",
      claimId: "studio",
      task: { id: 2, name: "Studio", country: null },
    });
    const wrapper = await mountPage();
    await wrapper.get("textarea").setValue("Old actor biography");
    await wrapper.get("select#contribution-category").setValue("enrich_studio");
    await vi.waitFor(() =>
      expect(mocks.fetch).toHaveBeenLastCalledWith("/api/get-random-task", {
        method: "POST",
        body: { category: "enrich_studio" },
        retry: 0,
      }),
    );
    await flushPromises();
    expect(wrapper.text()).toContain("Studio");
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeDefined();
  });

  it("preserves form input on failure and advances only after confirmed success", async () => {
    mocks.fetch.mockResolvedValueOnce(claimed);
    const wrapper = await mountPage("/contribute/task/play?category=enrich_voice_actor");
    await wrapper.get("textarea").setValue("Biography");
    mocks.fetch.mockRejectedValueOnce(new Error("offline"));
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get("textarea").element.value).toBe("Biography");
    expect(wrapper.find('[role="alert"]').text()).toContain("Unable to submit");
    mocks.fetch.mockResolvedValueOnce({ success: true, pointsAwarded: 10 });
    mocks.fetch.mockResolvedValueOnce({
      ...claimed,
      claimId: "claim-2",
      task: { ...claimed.task, firstname: "Next" },
    });
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("Next Actor");
    expect(wrapper.get("textarea").element.value).toBe("");
    expect(mocks.fetch).toHaveBeenLastCalledWith("/api/get-random-task", {
      method: "POST",
      body: { category: "enrich_voice_actor" },
      retry: 0,
    });
  });

  it("offers a first picture upload only while the actor picture is empty", async () => {
    mocks.fetch.mockResolvedValueOnce({
      ...claimed,
      task: { ...claimed.task, profile_picture: "existing.jpg" },
    });
    const existing = await mountPage();
    expect(existing.find('input[type="file"]').exists()).toBe(false);
    existing.unmount();
    mounted.splice(mounted.indexOf(existing), 1);
    mocks.fetch.mockResolvedValueOnce({
      ...claimed,
      task: { ...claimed.task, profile_picture: null },
    });
    const empty = await mountPage();
    expect(empty.find('input[type="file"]').exists()).toBe(true);
    expect(empty.get('[role="button"]').attributes("tabindex")).toBe("0");
  });

  it("disables editing and navigation while a submission is pending", async () => {
    mocks.fetch.mockResolvedValueOnce(claimed);
    const wrapper = await mountPage();
    await wrapper.get("textarea").setValue("Biography");
    let resolveSubmission: (value: { success: true; pointsAwarded: number }) => void = () => {};
    mocks.fetch.mockReturnValueOnce(
      new Promise<{ success: true; pointsAwarded: number }>((resolve) => {
        resolveSubmission = resolve;
      }),
    );
    await wrapper.get("form").trigger("submit");
    expect(wrapper.get("textarea").attributes("disabled")).toBeDefined();
    expect(wrapper.get("select#contribution-category").attributes("disabled")).toBeDefined();
    expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeDefined();
    mocks.fetch.mockResolvedValueOnce({
      task: null,
      category: "enrich_voice_actor",
      claimId: null,
      expiresAt: null,
    });
    resolveSubmission({ success: true, pointsAwarded: 10 });
    await flushPromises();
    expect(wrapper.text()).toContain("contribute.noTasksAvailable");
  });

  it("redirects a rejected session and does not loop on the failed request", async () => {
    mocks.fetch.mockRejectedValue({ statusCode: 401 });
    await mountPage();
    await nextTick();
    expect(mocks.navigate).toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
