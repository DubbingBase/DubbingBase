import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import DuplicateVATool from "../DuplicateVATool.vue";

const invokeMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

describe("DuplicateVATool.vue", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("requests find_duplicate_voice_actors using a GET method", async () => {
    invokeMock.mockResolvedValueOnce({ data: [], error: null });

    const wrapper = mount(DuplicateVATool);
    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("find_duplicate_voice_actors", {
      method: "GET",
    });
  });

  it("renders duplicate groups returned by the function", async () => {
    invokeMock.mockResolvedValueOnce({
      data: [
        {
          actors: [
            { id: 1, firstname: "Jean", lastname: "Dupont" },
            { id: 2, firstname: "Jean", lastname: "Dupont" },
          ],
        },
      ],
      error: null,
    });

    const wrapper = mount(DuplicateVATool);
    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Duplicate Candidates");
    expect(wrapper.text()).toContain("Jean Dupont");
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2);
  });

  it("shows the empty state when no duplicates are found", async () => {
    invokeMock.mockResolvedValueOnce({ data: [], error: null });

    const wrapper = mount(DuplicateVATool);
    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("No duplicates found");
  });

  it("surfaces an error message when the function call fails", async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: new Error("network down"),
    });

    const wrapper = mount(DuplicateVATool);
    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("network down");
  });
});