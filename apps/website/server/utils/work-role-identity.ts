export function findUniqueWorkRoleMatch<T extends { id: number }>(
  works: T[],
  matchingWorkIds: number[],
): T | undefined {
  const matchingIds = new Set(matchingWorkIds);
  const matches = works.filter((work) => matchingIds.has(work.id));

  if (matches.length > 1) {
    throw new Error("Multiple work records match this role identity");
  }

  return matches[0];
}
