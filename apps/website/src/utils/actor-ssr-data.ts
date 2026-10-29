import { markRaw } from "vue";
import type { ActorDataPayload } from "@app/shared-logic";

type ActorVoiceActor = ActorDataPayload["voiceRoles"][number]["voice_actors"][number];

function shareVoiceActorReferences(voiceRoles: ActorDataPayload["voiceRoles"]): void {
  const voiceActorsById = new Map<number, ActorVoiceActor>();

  for (const role of voiceRoles) {
    for (let index = 0; index < role.voice_actors.length; index += 1) {
      const voiceActor = role.voice_actors[index];
      if (!voiceActor) continue;

      const existingVoiceActor = voiceActorsById.get(voiceActor.id);
      if (existingVoiceActor) {
        role.voice_actors[index] = existingVoiceActor;
      } else {
        voiceActorsById.set(voiceActor.id, voiceActor);
      }
    }
  }
}

export function prepareActorSsrData(payload: ActorDataPayload | null | undefined): void {
  if (!payload) return;

  // Nuxt's payload serializer preserves shared references and writes each actor once.
  shareVoiceActorReferences(payload.voiceRoles);

  // SSR reads this request's snapshot. These non-enumerable markers are not
  // serialized, so the browser still receives normally reactive data.
  if (payload.actor) markRaw(payload.actor);
  markRaw(payload.voiceRoles);
}
