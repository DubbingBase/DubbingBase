import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import DuplicateWork from "../DuplicateWork.vue";

const invokeMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

describe("DuplicateWork.vue", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    // The component triggers a scan immediately on module setup, so give
    // every test a default resolved response before mounting.
    invokeMock.mockResolvedValue({ data: [], error: null });
  });

  it("automatically requests find_duplicate_work using a GET method on mount", async () => {
    mount(DuplicateWork);
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("find_duplicate_work", {
      method: "GET",
    });
  });

  it("renders duplicate work groups returned by the function", async () => {
    invokeMock.mockResolvedValueOnce({
      data: [
        {
          works: [
            { id: 1, content_id: 10, actor_id: 100, voice_actor_id: 200, status: "approved", performance: "Bob", content_type: "movie" },
            { id: 2, content_id: 10, actor_id: 100, voice_actor_id: 200, status: "waiting", performance: "Bob", content_type: "movie" },
          ],
        },
      ],
      error: null,
    });

    const wrapper = mount(DuplicateWork);
    await flushPromises();

    expect(wrapper.text()).toContain("Duplicate Work Group");
    expect(wrapper.findAll("tbody tr")).toHaveLength(2);
  });

  it("shows the empty state when there are no duplicate work entries", async () => {
    const wrapper = mount(DuplicateWork);
    await flushPromises();

    expect(wrapper.text()).toContain("No duplicate work entries found");
  });

  it("surfaces an error message when the function call fails", async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: new Error("scan failed"),
    });

    const wrapper = mount(DuplicateWork);
    await flushPromises();

    expect(wrapper.text()).toContain("scan failed");
  });
});