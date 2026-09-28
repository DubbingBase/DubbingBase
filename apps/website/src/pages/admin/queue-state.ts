export type QueueArchiveFilter = "active" | "archived" | "all";
export type QueueStatusFilter =
  | "all"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "review_needed";
export type QueueFilterSelection = QueueArchiveFilter | "review_needed";

export function queueFilterStateForSelection(
  selection: QueueFilterSelection,
  currentStatus: QueueStatusFilter,
): { archiveFilter: QueueArchiveFilter; filterStatus: QueueStatusFilter } {
  if (selection === "review_needed") {
    return { archiveFilter: "archived", filterStatus: "review_needed" };
  }

  return {
    archiveFilter: selection,
    filterStatus:
      currentStatus === "review_needed" && selection !== "archived" ? "all" : currentStatus,
  };
}
