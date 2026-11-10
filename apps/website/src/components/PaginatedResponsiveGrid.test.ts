import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
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

  it("can keep only the bottom pager for a locally scoped collection", () => {
    const wrapper = mount(PaginatedResponsiveGrid, {
      props: {
        items: Array.from({ length: 13 }, (_, index) => ({ id: index + 1 })),
        pageSize: 12,
        paginationLabel: "Actor credits",
        showTopPagination: false,
      },
      slots: { default: ({ item }) => `item-${item.id}` },
      global: { mocks: { $t: (key: string) => key } },
    });

    expect(wrapper.findAll("nav")).toHaveLength(1);
    expect(wrapper.get("nav").attributes("aria-label")).toBe(
      "Actor credits: common.paginationBottom",
    );
    expect(wrapper.text()).toContain("Actor credits");
  });

  it("pages locally from either control, scrolls to its own results and clamps shrinking data", async () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    const wrapper = mount(PaginatedResponsiveGrid, {
      attachTo: document.body,
      props: {
        items: Array.from({ length: 30 }, (_, index) => ({ id: index + 1 })),
        pageSize: 12,
        paginationLabel: "Group",
      },
      slots: { default: ({ item }) => `item-${item.id};` },
      global: { mocks: { $t: (key: string) => key } },
    });
    try {
      expect(wrapper.get("nav:last-of-type").attributes("aria-label")).toBe(
        "Group: common.paginationBottom",
      );

      await wrapper.get("nav:last-of-type button:last-of-type").trigger("click");
      expect(wrapper.text()).toContain("item-13;");
      expect(wrapper.text()).not.toContain("item-12;");
      expect(wrapper.emitted("update:page")).toEqual([[2]]);
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(wrapper.element);

      await wrapper.get("nav:first-of-type button:last-of-type").trigger("click");
      expect(wrapper.text()).toContain("item-30;");
      expect(wrapper.emitted("update:page")?.at(-1)).toEqual([3]);

      await wrapper.setProps({ items: [{ id: 1 }, { id: 2 }] });
      expect(wrapper.emitted("update:page")?.at(-1)).toEqual([1]);
      expect(wrapper.text()).toContain("item-1;");
      expect(wrapper.findAll("nav")).toHaveLength(0);
    } finally {
      wrapper.unmount();
      Element.prototype.scrollIntoView = original;
    }
  });
});
