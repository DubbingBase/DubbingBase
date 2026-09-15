import { describe, expect, it } from "vitest";
import { paginateArray, parsePagination } from "./pagination";

describe("parsePagination", () => {
  it("uses safe defaults and caps oversized pages", () => {
    expect(parsePagination({ page: "invalid", pageSize: 500 })).toEqual({
      page: 1,
      pageSize: 48,
      totalItems: 0,
      totalPages: 0,
    });
  });
});

describe("paginateArray", () => {
  it("returns a page and complete pagination metadata", () => {
    expect(paginateArray([1, 2, 3, 4, 5], { page: 2, pageSize: 2 })).toEqual({
      items: [3, 4],
      pagination: {
        page: 2,
        pageSize: 2,
        totalItems: 5,
        totalPages: 3,
      },
    });
  });

  it("clamps a page beyond the end to the final page", () => {
    expect(paginateArray([1, 2, 3], { page: 99, pageSize: 2 })).toEqual({
      items: [3],
      pagination: {
        page: 2,
        pageSize: 2,
        totalItems: 3,
        totalPages: 2,
      },
    });
  });
});
