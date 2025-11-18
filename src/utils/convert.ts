import { PersonData, Role } from "@/components/PersonItem.vue";
import {
    Actor,
    VoiceActorDetails,
} from "../../supabase/functions/_shared/types";

export const actorToPersonData = (actor: Actor): PersonData<Actor> => {
    const roles: Role[] = [];

    // console.log("actor.roles", actor.roles);

    if (actor.roles) {
        roles.push(...actor.roles.map((role) => ({
            character: role.character,
            image: "",
        })));
    }
    if (actor.character) {
        roles.push({
            character: actor.character,
            image: "",
        });
    }

    return {
        id: actor.id,
        name: actor.name,
        roles,
        profile_picture: actor.profile_path,
        performance: "acting",
        tags: [],
        tmdb_id: actor.id,
        data: actor,
    };
};

export const voiceActorToPersonData = (
    va: VoiceActorDetails,
    performance: string,
    actorId: number,
    reviewedStatus?: string,
    workId?: number,
): PersonData<VoiceActorDetails> => {
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
