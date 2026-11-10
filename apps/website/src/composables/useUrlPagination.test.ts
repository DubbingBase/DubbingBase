import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { createMemoryHistory, createRouter, type LocationQueryRaw } from "vue-router";
import { describe, expect, it, vi } from "vitest";
import { readUrlPage, useUrlPagination } from "./useUrlPagination";

async function setup(query: LocationQueryRaw = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: defineComponent(() => () => null) }],
  });
  await router.push({ path: "/", query });
  let pagination: ReturnType<typeof useUrlPagination> | undefined;
  const wrapper = mount(
    defineComponent({
      setup() {
        pagination = useUrlPagination("castPage");
        return () => null;
      },
    }),
    { global: { plugins: [router] } },
  );
  if (!pagination) throw new Error("Pagination was not initialized");
  return { router, pagination, wrapper };
}

describe("useUrlPagination", () => {
  it("normalizes invalid URL values to page one", () => {
    expect(readUrlPage(undefined)).toBe(1);
    expect(readUrlPage("invalid")).toBe(1);
    expect(readUrlPage("0")).toBe(1);
  });

  it("reads positive page numbers from route query values", () => {
    expect(readUrlPage("3")).toBe(3);
    expect(readUrlPage(["4", "5"])).toBe(4);
  });

  it("does not navigate when already on the default or requested page", async () => {
    const { router, pagination, wrapper } = await setup();
    const replace = vi.spyOn(router, "replace");
    await pagination.setPage(1);
    await router.push({ query: { castPage: "3" } });
    await pagination.setPage(3);
    expect(replace).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("preserves unrelated queries and removes the page parameter on reset", async () => {
    const { router, pagination, wrapper } = await setup({
      castPage: "3",
      dub: "7",
      seasonsPage: "2",
    });
    await pagination.setPage(1);
    expect(router.currentRoute.value.query).toEqual({ dub: "7", seasonsPage: "2" });
    await pagination.setPage(4);
    expect(router.currentRoute.value.query).toEqual({ castPage: "4", dub: "7", seasonsPage: "2" });
    wrapper.unmount();
  });
});
