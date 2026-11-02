import { describe, expect, it } from "vitest";
import { resolveDetailCollectionProject } from "@app/shared-logic";

const projects = [{ id: 17 }, { id: 18 }];

describe("resolveDetailCollectionProject", () => {
  it("does not resolve the virtual original query to a persisted project", () => {
    expect(resolveDetailCollectionProject(projects, "original")).toBeUndefined();
    expect(resolveDetailCollectionProject(projects, ["original"])).toBeUndefined();
  });

  it("preserves the default and explicit real project selection", () => {
    expect(resolveDetailCollectionProject(projects, undefined)).toBe(projects[0]);
    expect(resolveDetailCollectionProject(projects, "18")).toBe(projects[1]);
    expect(resolveDetailCollectionProject(projects, "invalid")).toBe(projects[0]);
  });
});
