import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import UserManagement from "../UserManagement.vue";

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

describe("UserManagement.vue", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    getSessionMock.mockReset();
  });

  it("requests list_users with a GET method and the session's bearer token", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-abc" } },
    });
    invokeMock.mockResolvedValue({ data: { users: [] }, error: null });

    mount(UserManagement);
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("list_users", {
      method: "GET",
      headers: { Authorization: "Bearer token-abc" },
    });
  });

  it("renders the users returned by list_users", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-abc" } },
    });
    invokeMock.mockResolvedValue({
      data: {
        users: [
          {
            id: "user-1",
            email: "alice@example.com",
            created_at: "2024-01-01T00:00:00.000Z",
            app_metadata: { role: "admin" },
          },
        ],
      },
      error: null,
    });

    const wrapper = mount(UserManagement);
    await flushPromises();

    expect(wrapper.text()).toContain("alice@example.com");
    expect(wrapper.find("select").element.value).toBe("admin");
  });

  it("surfaces an error when there is no active session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    const wrapper = mount(UserManagement);
    await flushPromises();

    expect(invokeMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("No active session found");
  });

  it("surfaces an error message when list_users fails", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-abc" } },
    });
    invokeMock.mockResolvedValue({
      data: null,
      error: new Error("failed to load"),
    });

    const wrapper = mount(UserManagement);
    await flushPromises();

    expect(wrapper.text()).toContain("failed to load");
  });
});