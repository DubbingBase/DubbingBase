import { describe, expect, it } from "vitest";
import {
  findUniqueWorkRoleMatch,
  workRoleIdentityKey,
} from "./work-role-identity";

describe("work role identity", () => {
  it("keeps different free-text roles distinct and normalizes name casing", () => {
    expect(workRoleIdentityKey(null, " Alice ")).toBe("name:alice");
    expect(workRoleIdentityKey(null, "alice")).toBe("name:alice");
    expect(workRoleIdentityKey(null, "Bob")).toBe("name:bob");
    expect(workRoleIdentityKey(null, "\tAlice\t")).toBe("name:\talice\t");
  });

  it("prefers character IDs and leaves missing role identity ambiguous", () => {
    expect(workRoleIdentityKey(12, "Different name")).toBe("id:12");
    expect(workRoleIdentityKey(null, "  ")).toBeNull();
    expect(workRoleIdentityKey(null, null)).toBeNull();
  });

  it("reuses one roleless row and surfaces multiple ambiguous candidates", () => {
    const rolelessWork = { id: 1, character_id: null, character_name: null };
    expect(findUniqueWorkRoleMatch([rolelessWork], null)).toBe(rolelessWork);
    expect(() =>
      findUniqueWorkRoleMatch([rolelessWork, { ...rolelessWork, id: 2 }], null),
    ).toThrow("Multiple work records match this role identity");
  });
});
