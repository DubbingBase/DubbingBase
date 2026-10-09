import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../db/client", () => ({
  useSupabaseAdmin: () => ({ rpc }),
}));

import { applyExtractedCredits } from "./voice-actor";

describe("applyExtractedCredits", () => {
  beforeEach(() => rpc.mockReset());

  it("persists a batch with one transactional RPC", async () => {
    rpc.mockResolvedValue({
      data: { new_voice_actors: 1, credits_added: 2 },
      error: null,
    });

    await expect(
      applyExtractedCredits(42, "movie", "fr-FR", [
        {
          firstname: "First",
          lastname: "Actor",
          actorId: 7,
          performance: "voice",
        },
        { firstname: "Second", lastname: "Actor", actorId: 8 },
      ]),
    ).resolves.toEqual({ newVoiceActors: 1, creditsAdded: 2 });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("apply_extracted_credits", {
      p_content_id: 42,
      p_content_type: "movie",
      p_dubbing_language: "fr-FR",
      p_credits: [
        {
          firstname: "First",
          lastname: "Actor",
          actor_id: 7,
          performance: "voice",
          character_id: null,
          character_name: null,
        },
        {
          firstname: "Second",
          lastname: "Actor",
          actor_id: 8,
          performance: null,
          character_id: null,
          character_name: null,
        },
      ],
    });
  });

  it("does not call the database for an empty extraction", async () => {
    await expect(applyExtractedCredits(42, "movie", "fr-FR", [])).resolves.toEqual({
      newVoiceActors: 0,
      creditsAdded: 0,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("propagates persistence errors so the queue can retry", async () => {
    const error = new Error("database unavailable");
    rpc.mockResolvedValue({ data: null, error });

    await expect(
      applyExtractedCredits(42, "movie", "fr-FR", [
        { firstname: "First", lastname: "Actor", actorId: 7 },
      ]),
    ).rejects.toBe(error);
  });
});
