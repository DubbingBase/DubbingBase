import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import LinkUserVoiceActor from "../LinkUserVoiceActor.vue";

const invokeMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

describe("LinkUserVoiceActor.vue", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    getSessionMock.mockReset();
  });

  it("requests list_users with a GET method and the session's bearer token", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-abc" } },
    });
    invokeMock.mockResolvedValue({ data: { users: [] }, error: null });

    mount(LinkUserVoiceActor);
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("list_users", {
      method: "GET",
      headers: { Authorization: "Bearer token-abc" },
    });
  });

  it("does not call list_users when there is no active session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    mount(LinkUserVoiceActor);
    await flushPromises();

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("shows an error toast when the list_users request fails", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-abc" } },
    });
    invokeMock.mockResolvedValue({
      data: null,
      error: new Error("boom"),
    });

    const wrapper = mount(LinkUserVoiceActor);
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("list_users", {
      method: "GET",
      headers: { Authorization: "Bearer token-abc" },
    });
    expect(wrapper.text()).toContain("Error loading users database");
  });
});