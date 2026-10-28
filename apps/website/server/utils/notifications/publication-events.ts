function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNewlyValidatedWork(
  previousValue: unknown,
  newValue: unknown,
): boolean {
  const previousStatus = isRecord(previousValue) ? previousValue.status : null;
  const newStatus = isRecord(newValue) ? newValue.status : null;
  return newStatus === "validated" && previousStatus !== "validated";
}

function recordField(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

export function projectPublicationActorIds(
  previousValue: unknown,
  newValue: unknown,
): number[] {
  const previousProject = recordField(previousValue, "project");
  const newProject = recordField(newValue, "project");
  if (!isRecord(newProject) || newProject.status !== "validated") return [];

  const previouslyPublished =
    isRecord(previousProject) && previousProject.status === "validated";
  const previousCast = recordField(previousValue, "cast");
  const existingIds = new Set(
    Array.isArray(previousCast)
      ? previousCast.flatMap((row) => {
          const record = isRecord(row) ? row : null;
          return typeof record?.id === "number" ? [record.id] : [];
        })
      : [],
  );
  const newCast = recordField(newValue, "cast");
  if (!Array.isArray(newCast)) return [];
  return [
    ...new Set(
      newCast.flatMap((row) => {
        const record = isRecord(row) ? row : null;
        if (
          !record ||
          record.status !== "validated" ||
          typeof record.voice_actor_id !== "number" ||
          (previouslyPublished &&
            (typeof record.id !== "number" || existingIds.has(record.id)))
        ) {
          return [];
        }
        return [record.voice_actor_id];
      }),
    ),
  ];
}
