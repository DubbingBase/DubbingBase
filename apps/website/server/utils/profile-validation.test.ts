import { createError } from "h3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let validation: typeof import("./profile-validation");

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  validation = await import("./profile-validation");
});

afterAll(() => vi.unstubAllGlobals());

function statusOf(run: () => unknown): { statusCode?: number; message?: string } {
  try {
    run();
  } catch (error) {
    if (error && typeof error === "object") {
      const statusCode = "statusCode" in error ? error.statusCode : undefined;
      const message = "message" in error ? error.message : undefined;
      return {
        statusCode: typeof statusCode === "number" ? statusCode : undefined,
        message: typeof message === "string" ? message : undefined,
      };
    }
  }
  return {};
}

describe("parseOptionalText", () => {
  it("passes through undefined, null and strings within the limit", () => {
    expect(validation.parseOptionalText(undefined, "bio", 10)).toBeUndefined();
    expect(validation.parseOptionalText(null, "bio", 10)).toBeNull();
    expect(validation.parseOptionalText("hello", "bio", 10)).toBe("hello");
    expect(validation.parseOptionalText("x".repeat(10), "bio", 10)).toBe("x".repeat(10));
  });

  it.each([
    ["a number", 5],
    ["a boolean", true],
    ["an array", ["a"]],
    ["an object", { a: 1 }],
    ["an overlong string", "x".repeat(11)],
  ])("rejects %s with a 400 naming the field", (_label, value) => {
    expect(statusOf(() => validation.parseOptionalText(value, "bio", 10))).toEqual({
      statusCode: 400,
      message: "Invalid bio",
    });
  });
});

describe("parseOptionalDate", () => {
  it("treats undefined as not provided and null or an empty string as none", () => {
    expect(validation.parseOptionalDate(undefined)).toBeUndefined();
    expect(validation.parseOptionalDate(null)).toBeNull();
    expect(validation.parseOptionalDate("")).toBeNull();
  });

  it("accepts a real ISO calendar date, including a leap day", () => {
    expect(validation.parseOptionalDate("1990-02-28")).toBe("1990-02-28");
    expect(validation.parseOptionalDate("2024-02-29")).toBe("2024-02-29");
  });

  it.each([
    ["a non-ISO format", "28/02/1990"],
    ["an impossible day", "1990-02-30"],
    ["a leap day in a non-leap year", "2023-02-29"],
    ["an impossible month", "2026-13-01"],
    ["a number", 19900228],
    ["an object", {}],
  ])("rejects %s with a 400", (_label, value) => {
    expect(statusOf(() => validation.parseOptionalDate(value))).toEqual({
      statusCode: 400,
      message: "Invalid date_of_birth",
    });
  });
});

describe("limits", () => {
  it("keeps the documented bio and nationality limits", () => {
    expect(validation.maxBioLength).toBe(5000);
    expect(validation.maxNationalityLength).toBe(100);
  });
});
