import { describe, expect, it, vi } from "vitest";
import {
  createDubbingProjectSaveClient,
  getEditableDubbingProjectStatus,
  getDubbingProjectSaveErrorMessage,
  isDubbingProjectSaveConflict,
  type DubbingProjectSaveRequest,
  type DubbingProjectSaveResponse,
} from "./dubbing-project-save";

const saveRequest: DubbingProjectSaveRequest = {
  project_id: 22,
  expected_updated_at: "2026-10-15T12:00:00",
  project: {
    content_id: 90,
    content_type: "movie",
    language: "fr-FR",
    studio_id: null,
    status: "validated",
  },
  crew: [],
  cast: [],
};

const saveResponse: DubbingProjectSaveResponse = {
  success: true,
  projectId: 22,
  updatedAt: "2026-10-15T12:05:00",
  auditLogId: "audit-1",
  replayed: false,
};

describe("controlled dubbing project save client", () => {
  it("limits loaded project statuses to the editor's supported values", () => {
    expect(getEditableDubbingProjectStatus("pending")).toBe("pending");
    expect(getEditableDubbingProjectStatus("draft")).toBe("draft");
    expect(getEditableDubbingProjectStatus("unknown")).toBe("validated");
  });

  it("reuses the request id after a failed request and clears it after success", async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(saveResponse)
      .mockResolvedValueOnce(saveResponse);
    let nextId = 0;
    const ids = vi.fn(() => `request-${++nextId}`);
    const save = createDubbingProjectSaveClient(transport, ids);

    await expect(save(saveRequest)).rejects.toThrow("network unavailable");
    await expect(save(saveRequest)).resolves.toEqual(saveResponse);
    await expect(save(saveRequest)).resolves.toEqual(saveResponse);

    expect(transport.mock.calls.map(([body]) => body.request_id)).toEqual([
      "request-1",
      "request-1",
      "request-2",
    ]);
  });

  it("uses a new request id when the project version changes after a conflict", async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce({ statusCode: 409, data: { message: "stale" } })
      .mockResolvedValueOnce(saveResponse);
    let nextId = 0;
    const ids = vi.fn(() => `request-${++nextId}`);
    const save = createDubbingProjectSaveClient(transport, ids);

    await expect(save(saveRequest)).rejects.toMatchObject({ statusCode: 409 });
    const refreshedRequest = {
      ...saveRequest,
      expected_updated_at: "2026-10-15T12:04:00",
    };
    await expect(save(refreshedRequest)).resolves.toEqual(saveResponse);

    expect(transport.mock.calls.map(([body]) => body.request_id)).toEqual([
      "request-1",
      "request-2",
    ]);
    expect(isDubbingProjectSaveConflict({ statusCode: 409 })).toBe(true);
    expect(getDubbingProjectSaveErrorMessage({ statusCode: 409 })).toContain(
      "Your changes are still here",
    );
  });
});
