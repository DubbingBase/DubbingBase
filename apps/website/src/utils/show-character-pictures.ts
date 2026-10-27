export interface CharacterProfilePicture {
  name?: string | null;
  image?: string | null;
}

export type CharacterPictureIndex = Map<string, string | null | undefined>;

export function indexCharacterPictures(
  pictures: readonly CharacterProfilePicture[],
): CharacterPictureIndex {
  const index: CharacterPictureIndex = new Map();
  for (const picture of pictures) {
    if (picture.name) {
      const normalizedName = picture.name.toLowerCase();
      if (!index.has(normalizedName)) index.set(normalizedName, picture.image);
    }
  }
  return index;
}

export function findCharacterImage(
  index: CharacterPictureIndex,
  namesToTry: readonly (string | null | undefined)[],
): string | null {
  for (const name of namesToTry) {
    if (!name) continue;
    const image = index.get(name.toLowerCase());
    if (image) return image;
  }
  return null;
}
