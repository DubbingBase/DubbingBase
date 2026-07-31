import { PersonData, Role } from "@/components/PersonItem.vue";
import { Actor } from "@supabase/functions/_shared/types";

export const cleanCharacterName = (name: string): string => {
  if (!name) return name;
  return name.replace(/\s*\([^)]*(?:voice|uncredited|voix|non cr[ée]dit[ée]?)[^)]*\)\s*/gi, '').trim();
};

export const actorToPersonData = <
  T extends {
    id: number;
    name: string;
    profile_path?: string | null;
    roles?: { character: string; [key: string]: unknown }[];
    character?: string;
  },
>(
  actor: T,
): PersonData<T> => {
  const roles: Role[] = [];

  // console.log("actor.roles", actor.roles);

  if (actor.roles) {
    roles.push(
      ...actor.roles.map((role) => ({
        character: cleanCharacterName(role.character),
        image: "",
      })),
    );
  }
  if (actor.character) {
    roles.push({
      character: cleanCharacterName(actor.character),
      image: "",
    });
  }

  return {
    id: actor.id,
    name: actor.name,
    roles,
    profile_picture: actor.profile_path ?? "",
    performance: "acting",
    tags: [],
    tmdb_id: actor.id,
    data: actor,
  };
};

export const voiceActorToPersonData = (
  va: {
    id: number;
    firstname?: string;
    lastname?: string;
    profile_picture?: string;
  },
  performance: string,
  actorId: number,
  reviewedStatus?: string,
  workId?: number,
): PersonData<{
  id: number;
  firstname?: string;
  lastname?: string;
  profile_picture?: string;
}> => {
  return {
    id: va.id,
    name: va.firstname + " " + va.lastname,
    roles: [],
    profile_picture: va.profile_picture,
    performance: performance,
    tags: [],
    tmdb_id: actorId,
    reviewed_status: reviewedStatus,
    work_id: workId,
    data: va,
  };
};
