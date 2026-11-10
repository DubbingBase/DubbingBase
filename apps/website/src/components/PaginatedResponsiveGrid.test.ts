import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import PaginationControls from "./PaginationControls.vue";
import PaginatedResponsiveGrid from "./PaginatedResponsiveGrid.vue";

describe("PaginatedResponsiveGrid", () => {
  it("slices a full client-side collection at the URL-selected page", () => {
    const items = Array.from({ length: 13 }, (_, index) => ({
      id: index + 1,
    }));
    const wrapper = mount(PaginatedResponsiveGrid, {
      props: { items, page: 2, pageSize: 12 },
      slots: {
        default: ({ item, index }) => `${item.id}:${index}`,
      },
      global: {
        components: { PaginationControls },
        mocks: { $t: (key: string) => key },
      },
    });

    expect(wrapper.text()).toContain("13:12");
    expect(wrapper.text()).not.toContain("1:0");
    expect(wrapper.findAll("nav")).toHaveLength(2);
    expect(wrapper.get("nav:first-of-type").attributes("aria-label")).toBe("common.paginationTop");
    expect(wrapper.get("nav:last-of-type").attributes("aria-label")).toBe(
      "common.paginationBottom",
    );
  });
});
