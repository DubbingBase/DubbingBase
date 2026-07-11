import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import QueueManagement from "../QueueManagement.vue";

const invokeMock = vi.fn();
const getSessionMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock("@/lib/mediaQueue", () => ({
  enqueueAndProcessMedia: vi.fn(),
}));

describe("QueueManagement.vue", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    getSessionMock.mockReset();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  it("requests list_users with a GET method and the session's bearer token", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-abc" } },
    });
    invokeMock.mockResolvedValue({ data: { users: [] }, error: null });

    mount(QueueManagement);
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("list_users", {
      method: "GET",
      headers: { Authorization: "Bearer token-abc" },
    });
  });

  it("does not call list_users when there is no active session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    mount(QueueManagement);
    await flushPromises();

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("maps user ids to emails from the list_users response for queue rows", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-abc" } },
    });
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 1,
          tmdb_id: 42,
          media_type: "movie",
          season_number: null,
          episode_number: null,
          status: "pending",
          error_message: null,
          user_id: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
    invokeMock.mockResolvedValue({
      data: { users: [{ id: "user-1", email: "user@example.com" }] },
      error: null,
    });

    const wrapper = mount(QueueManagement);
    await flushPromises();

    expect(wrapper.text()).toContain("user@example.com");
  });

  it("does not fail the queue load when list_users errors, and falls back to an anonymized label", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-abc" } },
    });
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 1,
          tmdb_id: 42,
          media_type: "movie",
          season_number: null,
          episode_number: null,
          status: "pending",
          error_message: null,
          user_id: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
    invokeMock.mockResolvedValue({ data: null, error: new Error("boom") });

    const wrapper = mount(QueueManagement);
    await flushPromises();

    expect(wrapper.text()).toContain("User (user-1)");
    expect(wrapper.find(".text-red-200").exists()).toBe(false);
  });
});