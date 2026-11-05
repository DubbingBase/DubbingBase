import type { Json } from "@app/supabase/types";
import type { Tables } from "@app/shared-logic";

/** Voice actor object returned inside RPC JSON results. */
export type VoiceActorRecord = Record<string, Json> &
  Pick<Tables<"voice_actors">, "id" | "firstname" | "lastname" | "profile_picture">;

export function isVoiceActorRecord(value: Json): value is VoiceActorRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof Reflect.get(value, "id") === "number" &&
    typeof Reflect.get(value, "firstname") === "string" &&
    typeof Reflect.get(value, "lastname") === "string" &&
    (typeof Reflect.get(value, "profile_picture") === "string" ||
      Reflect.get(value, "profile_picture") === null)
  );
}
