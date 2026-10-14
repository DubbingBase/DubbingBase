import { describe, expect, it } from "vitest";
import {
  authorizeTaskContribution,
  validateTaskContribution,
  type TaskContributionInput,
} from "./task-submission-validation";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function validInput(overrides: Partial<TaskContributionInput> = {}): TaskContributionInput {
  return {
    claimId: "opaque-claim-id",
    category: "enrich_voice_actor",
    entityId: "42",
    fields: { nationality: "French" },
    currentValues: { nationality: null, profile_picture: null },
    ...overrides,
  };
}

describe("task contribution validation", () => {
  it("accepts only whitelisted fields and returns normalized updates", () => {
    expect(validateTaskContribution(validInput())).toEqual({
      entityId: 42,
      updates: { nationality: "French" },
      uploadTarget: null,
    });
  });

  it.each(["category", "entityId", "claimId", "updated_by", "pointsAwarded"])(
    "rejects authority or protected field %s",
    (field) => {
      expect(() =>
        validateTaskContribution(validInput({ fields: { [field]: "attacker" } })),
      ).toThrow();
    },
  );

  it.each(["0", "-1", "1.1", "01", "9007199254740992", "1x"])(
    "rejects invalid entity id %s",
    (entityId) => expect(() => validateTaskContribution(validInput({ entityId }))).toThrow(),
  );

  it("requires claim metadata and a concrete supported category", () => {
    expect(() => validateTaskContribution(validInput({ claimId: " " }))).toThrow();
    expect(() => validateTaskContribution(validInput({ category: "any" }))).toThrow();
  });

  it("rejects empty values and contributions to fields that are already populated", () => {
    expect(() =>
      validateTaskContribution(validInput({ fields: { nationality: "   " } })),
    ).toThrow();
    expect(() =>
      validateTaskContribution(validInput({ currentValues: { nationality: "Canadian" } })),
    ).toThrow();
  });

  it("validates real calendar dates and absolute HTTP(S) URLs", () => {
    expect(
      validateTaskContribution(
        validInput({
          fields: { date_of_birth: "2024-02-29" },
          currentValues: { date_of_birth: null },
        }),
      ).updates.date_of_birth,
    ).toBe("2024-02-29");
    expect(() =>
      validateTaskContribution(
        validInput({
          fields: { date_of_birth: "2023-02-29" },
          currentValues: { date_of_birth: null },
        }),
      ),
    ).toThrow();
    expect(() =>
      validateTaskContribution(
        validInput({
          category: "enrich_studio",
          fields: { website_url: "javascript:alert(1)" },
          currentValues: { website_url: null },
        }),
      ),
    ).toThrow();
  });

  it("validates image type, signature, size, and upload-only authorization", () => {
    const upload = { filename: "x.png", type: "image/png", data: png };
    expect(validateTaskContribution(validInput({ upload }))).toMatchObject({
      uploadTarget: "profile_picture",
    });
    expect(() =>
      validateTaskContribution(validInput({ upload: { ...upload, data: Buffer.from("no") } })),
    ).toThrow();
    expect(() =>
      validateTaskContribution(
        validInput({
          upload: { ...upload, data: Buffer.alloc(5 * 1024 * 1024 + 1) },
        }),
      ),
    ).toThrow();
    expect(() =>
      authorizeTaskContribution({
        userId: null,
        category: "enrich_voice_actor",
      }),
    ).toThrow();
    expect(() =>
      authorizeTaskContribution({
        userId: "u1",
        category: "enrich_voice_actor",
        upload,
      }),
    ).toThrow();
    expect(() =>
      authorizeTaskContribution({
        userId: "u1",
        category: "enrich_voice_actor",
        upload,
        currentUploadValue: null,
      }),
    ).not.toThrow();
    expect(() =>
      authorizeTaskContribution({
        userId: "u1",
        category: "enrich_voice_actor",
        upload,
        currentUploadValue: "existing.png",
      }),
    ).toThrow();
    expect(() =>
      authorizeTaskContribution({
        userId: "u1",
        role: "admin",
        category: "enrich_voice_actor",
        upload,
        currentUploadValue: "existing.png",
      }),
    ).not.toThrow();
    expect(() =>
      validateTaskContribution(
        validInput({
          upload,
          role: "admin",
          currentValues: { profile_picture: "existing.png", nationality: null },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      authorizeTaskContribution({
        userId: "u1",
        role: "admin",
        category: "enrich_studio",
        upload,
        currentUploadValue: "existing-logo.png",
      }),
    ).toThrow();
    expect(() =>
      validateTaskContribution(
        validInput({
          category: "enrich_studio",
          upload,
          role: "admin",
          fields: {},
          currentValues: { logo_url: "existing-logo.png" },
        }),
      ),
    ).toThrow();
  });
});
