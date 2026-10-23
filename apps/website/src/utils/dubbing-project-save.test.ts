import { describe, expect, it, vi } from "vitest";
import {
  createDubbingProjectSaveClient,
  getEditableDubbingProjectStatus,
  getDubbingProjectSaveErrorMessage,
  isDubbingProjectSaveConflict,
  serializeGameProjectCastRows,
  type GameProjectCastEditorRow,
  type DubbingProjectSaveRequest,
  type DubbingProjectSaveResponse,
  type DubbingProjectSaveTransport,
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

  it("preserves role-distinct custom game names across save, refresh, and save", async () => {
    const requests: Array<DubbingProjectSaveRequest & { request_id: string }> =
      [];
    const transport: DubbingProjectSaveTransport = async (request) => {
      requests.push(request);
      return saveResponse;
    };
    let requestId = 0;
    const save = createDubbingProjectSaveClient(transport, () => {
      requestId += 1;
      return `request-${requestId}`;
    });
    const initialRows: GameProjectCastEditorRow[] = [
      {
        character_id: "custom_captain",
        character_name: "Captain",
        voice_actor_id: 41,
        performance: "dialogues",
        note: "",
        highlight: false,
      },
      {
        character_id: "custom_pilot",
        character_name: "Pilot",
        voice_actor_id: 41,
        performance: "voice-over",
        note: "",
        highlight: false,
      },
    ];

    await save({
      ...saveRequest,
      project: { ...saveRequest.project, content_type: "video_game" },
      cast: serializeGameProjectCastRows(initialRows),
    });

    const savedRows = requests[0]?.cast;
    expect(savedRows).toHaveLength(2);
    if (!savedRows) throw new Error("Expected the first save payload");
    const refreshedRows: GameProjectCastEditorRow[] = savedRows.map(
      (row, index) => ({
        id: index + 1,
        character_id: row.character_id ?? null,
        character_name: row.character_name ?? "",
        voice_actor_id: row.voice_actor_id ?? null,
        performance: row.performance ?? "dialogues",
        note: row.note ?? "",
        highlight: row.highlight ?? false,
        expectedUpdatedAt: "2026-10-15T12:05:00",
        expected: {
          actor_id: row.actor_id ?? null,
          character_id: row.character_id ?? null,
          character_name: row.character_name ?? null,
          voice_actor_id: row.voice_actor_id ?? null,
          performance: row.performance ?? null,
          note: row.note ?? null,
          highlight: row.highlight ?? false,
          status: "validated",
        },
      }),
    );

    await save({
      ...saveRequest,
      expected_updated_at: "2026-10-15T12:05:00",
      project: { ...saveRequest.project, content_type: "video_game" },
      cast: serializeGameProjectCastRows(refreshedRows),
    });

    expect(requests[0]?.cast.map((row) => row.character_name)).toEqual([
      "Captain",
      "Pilot",
    ]);
    expect(requests[1]?.cast).toMatchObject([
      {
        id: 1,
        character_id: null,
        character_name: "Captain",
        voice_actor_id: 41,
      },
      {
        id: 2,
        character_id: null,
        character_name: "Pilot",
        voice_actor_id: 41,
      },
    ]);
  });
});
