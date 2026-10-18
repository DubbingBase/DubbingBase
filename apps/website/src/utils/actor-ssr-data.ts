import { markRaw } from "vue";
import type { ActorDataPayload } from "@app/shared-logic";

export function prepareActorSsrData(payload: ActorDataPayload | null | undefined): void {
  if (!payload) return;

  // SSR reads this request's snapshot. These non-enumerable markers are not
  // serialized, so the browser still receives normally reactive data.
  if (payload.actor) markRaw(payload.actor);
  markRaw(payload.voiceRoles);
}
