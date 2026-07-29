import { ref, watch, Ref } from "vue";
import { actorToPersonData } from "@/utils/convert";
import { findCharacter } from "@/utils/character";

export function useDeferredCharacters(
  castSource: () => any[] | undefined,
  characterProfilePictures: Ref<any[]>,
  options: { deduplicateRolesByImage?: boolean } = {},
) {
  const actors = ref<any[]>([]);

  watch(
    [castSource, characterProfilePictures],
    ([cast, pics]) => {
      if (!cast || cast.length === 0) {
        actors.value = [];
        return;
      }

      // Fast initial map without image matching to unblock the main UI thread
      const initialActors = cast.map((c: any) => {
        const person = actorToPersonData(c);
        if (person.roles) {
          for (const role of person.roles) {
            role.image = ""; // Placeholder initially
          }
        }
        return person;
      });

      actors.value = initialActors;

      // Defer heavy matching logic
      if (pics && pics.length > 0) {
        setTimeout(() => {
          const matchedActors = initialActors.map((person) => {
            const personCopy = { ...person };
            if (personCopy.roles) {
              // Shallow copy roles to trigger reactivity if needed
              personCopy.roles = [...personCopy.roles];
              for (const role of personCopy.roles) {
                const image = pics.find((character: any) =>
                  findCharacter(character, role),
                )?.image;
                role.image = image ?? "";
              }

              if (options.deduplicateRolesByImage) {
                personCopy.roles = personCopy.roles.filter(
                  (role: any, index: number, self: any[]) =>
                    index ===
                    self.findIndex((r: any) => r.image === role.image),
                );
              }
            }
            return personCopy;
          });
          actors.value = matchedActors;
        }, 0);
      }
    },
    { immediate: true },
  );

  return { actors };
}
