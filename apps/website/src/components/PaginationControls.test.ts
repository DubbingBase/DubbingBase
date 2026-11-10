import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import PaginationControls from "./PaginationControls.vue";

describe("PaginationControls", () => {
  it("scrolls to the explicit results target after selecting a page", async () => {
    const target = document.createElement("section");
    target.id = "pagination-results";
    target.scrollIntoView = vi.fn();
    document.body.append(target);

    const wrapper = mount(PaginationControls, {
      props: {
        page: 1,
        totalItems: 13,
        scrollTargetId: target.id,
      },
      global: { mocks: { $t: (key: string) => key } },
    });

    await wrapper.get("button:last-of-type").trigger("click");
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "start" });

    wrapper.unmount();
    target.remove();
  });
});
