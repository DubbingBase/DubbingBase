import { Role } from "@/components/PersonItem.vue";

export const findCharacter = (
  character: { name: string; [key: string]: any },
  role: Role,
) => {
  if (!character.name || !role.character) return false;

  const characterName = character.name.toLowerCase();
  const roleName = role.character.toLowerCase();

  const allNames = characterName.split("/").map((name) => name.trim());
  const allRoleNames = roleName.split("/").map((name) => name.trim());

  // Loop through allNames and allRoleNames to find at least one correspondence
  for (const name of allNames) {
    for (const rName of allRoleNames) {
      // Direct name matching
      if (
        name === rName ||
        name.includes(rName) ||
        rName.includes(name)
      ) {
        return true;
      }

      // Simplified name matching for current pair
      const simplifiedName = name.replace(/(.*)( '?.*' ?)(.*)/, "$1 $3");
      const simplifiedRoleName = rName.replace(
        /(.*)( '?.*' ?)(.*)/,
        "$1 $3",
      );

      if (
        simplifiedName.includes(rName) ||
        name.includes(simplifiedRoleName) ||
        simplifiedName.includes(simplifiedRoleName)
      ) {
        return true;
      }
    }
  }

  const simplifiedName = characterName.replace(/(.*)( '?.*' ?)(.*)/, "$1 $3");
  const simplifiedRoleName = roleName.replace(/(.*)( '?.*' ?)(.*)/, "$1 $3");

  return (
    characterName.includes(roleName) ||
    simplifiedName.includes(roleName) ||
    characterName.includes(simplifiedRoleName) ||
    simplifiedName.includes(simplifiedRoleName)
  );
};
