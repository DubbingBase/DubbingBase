import { describe, expect, it } from "vitest";
import { queueFilterStateForSelection } from "./queue-state";

describe("queue archive filter transitions", () => {
  it("selects archived review-needed items", () => {
    expect(queueFilterStateForSelection("review_needed", "all")).toEqual({
      archiveFilter: "archived",
      filterStatus: "review_needed",
    });
  });

  it("leaves review-needed mode when Active is selected", () => {
    expect(queueFilterStateForSelection("active", "review_needed")).toEqual({
      archiveFilter: "active",
      filterStatus: "all",
    });
  });

  it("leaves review-needed mode when All is selected", () => {
    expect(queueFilterStateForSelection("all", "review_needed")).toEqual({
      archiveFilter: "all",
      filterStatus: "all",
    });
  });

  it("keeps review-needed mode when Archived is selected", () => {
    expect(queueFilterStateForSelection("archived", "review_needed")).toEqual({
      archiveFilter: "archived",
      filterStatus: "review_needed",
    });
  });

  it("preserves a normal status when switching archive mode", () => {
    expect(queueFilterStateForSelection("archived", "failed")).toEqual({
      archiveFilter: "archived",
      filterStatus: "failed",
    });
  });
});
