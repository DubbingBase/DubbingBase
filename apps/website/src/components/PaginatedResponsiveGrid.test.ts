import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
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
      global: { stubs: { PaginationControls: true } },
    });

    expect(wrapper.text()).toContain("13:12");
    expect(wrapper.text()).not.toContain("1:0");
  });
});
