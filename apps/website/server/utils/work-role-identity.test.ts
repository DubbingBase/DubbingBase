import { describe, expect, it } from "vitest";
import { findUniqueWorkRoleMatch } from "./work-role-identity";

describe("work role identity", () => {
  it("selects only records returned by the SQL identity matcher", () => {
    const work = { id: 1 };
    expect(findUniqueWorkRoleMatch([work, { id: 2 }], [1])).toBe(work);
    expect(findUniqueWorkRoleMatch([work], [])).toBeUndefined();
  });

  it("surfaces multiple candidates returned by the SQL identity matcher", () => {
    expect(() => findUniqueWorkRoleMatch([{ id: 1 }, { id: 2 }], [1, 2])).toThrow(
      "Multiple work records match this role identity",
    );
  });
});
