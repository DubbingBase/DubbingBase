import { describe, expect, it } from "vitest";
import { readUrlPage } from "./useUrlPagination";

describe("useUrlPagination", () => {
  it("normalizes invalid URL values to page one", () => {
    expect(readUrlPage(undefined)).toBe(1);
    expect(readUrlPage("invalid")).toBe(1);
    expect(readUrlPage("0")).toBe(1);
  });

  it("reads positive page numbers from route query values", () => {
    expect(readUrlPage("3")).toBe(3);
    expect(readUrlPage(["4", "5"])).toBe(4);
  });
});
