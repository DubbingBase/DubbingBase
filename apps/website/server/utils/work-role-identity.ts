export function workRoleIdentityKey(
  characterId: number | null | undefined,
  characterName: string | null | undefined,
): string | null {
  if (characterId !== null && characterId !== undefined) {
    return `id:${characterId}`;
  }

  const normalizedName = characterName
    ?.replace(/^ +| +$/g, "")
    .toLocaleLowerCase("en-US");
  return normalizedName ? `name:${normalizedName}` : null;
}

export function findUniqueWorkRoleMatch<
  T extends { character_id: number | null; character_name: string | null },
>(works: T[], roleKey: string | null): T | undefined {
  const matches = works.filter(
    (work) =>
      workRoleIdentityKey(work.character_id, work.character_name) === roleKey,
  );

  if (matches.length > 1) {
    throw new Error("Multiple work records match this role identity");
  }

  return matches[0];
}
