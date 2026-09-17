export const editableWorkFields = [
  "performance",
  "status",
  "reviewed_status",
  "note",
  "highlight",
  "source_id",
  "suggestions",
  "character_name",
] as const;

export type EditableWorkField = (typeof editableWorkFields)[number];

export interface DuplicateWorkEntry {
  id: number;
  dubbing_project_id: number;
  actor_id: number | null;
  character_id: number | null;
  voice_actor_id: number | null;
  character_name: string | null;
  performance: string | null;
  status: string | null;
  reviewed_status: "waiting" | "accepted" | "rejected" | null;
  note: string | null;
  highlight: boolean | null;
  source_id: number | null;
  sourceName: string | null;
  suggestions: string | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  voteCount: number;
  upVotes: number;
  downVotes: number;
  voiceActor: { id: number; firstName: string; lastName: string } | null;
}

export interface DuplicateWorkGroup {
  groupId: number;
  groupSize: number;
  identity: {
    dubbingProjectId: number;
    actorId: number | null;
    characterId: number | null;
    voiceActorId: number | null;
  };
  project: {
    id: number;
    contentId: number;
    contentType: string;
    language: string | null;
  };
  works: DuplicateWorkEntry[];
}

export interface DuplicateWorkPage {
  items: DuplicateWorkGroup[];
  nextCursor: number | null;
  totalGroups: number;
}

export type EditableWorkValues = Pick<DuplicateWorkEntry, EditableWorkField>;

const reviewPriority = (
  status: DuplicateWorkEntry["reviewed_status"],
): number => {
  switch (status) {
    case "accepted":
      return 3;
    case "waiting":
      return 2;
    case "rejected":
      return 1;
    default:
      return 0;
  }
};

const isPopulated = (value: unknown): boolean =>
  typeof value === "boolean" ||
  (typeof value === "string"
    ? value.trim().length > 0
    : value !== null && value !== undefined);

const populatedFieldCount = (work: DuplicateWorkEntry): number =>
  editableWorkFields.filter((field) => isPopulated(work[field])).length;

const activityTime = (work: DuplicateWorkEntry): number => {
  const value = work.updated_at || work.created_at;
  return value ? Date.parse(value) || 0 : 0;
};

export function rankDuplicateWorks(
  works: DuplicateWorkEntry[],
): DuplicateWorkEntry[] {
  return [...works].sort((left, right) => {
    const reviewDifference =
      reviewPriority(right.reviewed_status) -
      reviewPriority(left.reviewed_status);
    if (reviewDifference !== 0) return reviewDifference;

    const fieldDifference =
      populatedFieldCount(right) - populatedFieldCount(left);
    if (fieldDifference !== 0) return fieldDifference;

    const timeDifference = activityTime(right) - activityTime(left);
    if (timeDifference !== 0) return timeDifference;

    return left.id - right.id;
  });
}

export function prefillDuplicateWork(
  canonical: DuplicateWorkEntry,
  works: DuplicateWorkEntry[],
): {
  values: EditableWorkValues;
  provenance: Record<EditableWorkField, number>;
} {
  const rankedSources = rankDuplicateWorks(works).filter(
    (work) => work.id !== canonical.id,
  );
  const values: EditableWorkValues = {
    performance: canonical.performance,
    status: canonical.status,
    reviewed_status: canonical.reviewed_status,
    note: canonical.note,
    highlight: canonical.highlight,
    source_id: canonical.source_id,
    suggestions: canonical.suggestions,
    character_name: canonical.character_name,
  };
  const provenance: Record<EditableWorkField, number> = {
    performance: canonical.id,
    status: canonical.id,
    reviewed_status: canonical.id,
    note: canonical.id,
    highlight: canonical.id,
    source_id: canonical.id,
    suggestions: canonical.id,
    character_name: canonical.id,
  };

  for (const field of editableWorkFields) {
    if (isPopulated(values[field])) continue;
    const source = rankedSources.find((work) => isPopulated(work[field]));
    if (source) {
      switch (field) {
        case "performance":
          values.performance = source.performance;
          break;
        case "status":
          values.status = source.status;
          break;
        case "reviewed_status":
          values.reviewed_status = source.reviewed_status;
          break;
        case "note":
          values.note = source.note;
          break;
        case "highlight":
          values.highlight = source.highlight;
          break;
        case "source_id":
          values.source_id = source.source_id;
          break;
        case "suggestions":
          values.suggestions = source.suggestions;
          break;
        case "character_name":
          values.character_name = source.character_name;
          break;
      }
      provenance[field] = source.id;
    }
  }

  return { values, provenance };
}
