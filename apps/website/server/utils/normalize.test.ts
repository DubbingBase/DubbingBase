import { describe, it, expect } from "vitest";
import { isExploitableVoiceActorName } from "./normalize";

describe("isExploitableVoiceActorName", () => {
  it.each(["N/A", "n/a", "N A", "?", "unknown", "Unknown", "inconnu", "none", "aucun"])(
    "rejects placeholder %s",
    (name) => {
      expect(isExploitableVoiceActorName(name)).toBe(false);
    },
  );

  it.each(["-", "—", "–", "--", "...", "???"])("rejects dash/punctuation-only %s", (name) => {
    expect(isExploitableVoiceActorName(name)).toBe(false);
  });

  it.each(["", "   ", null, undefined])("rejects empty %s", (name) => {
    expect(isExploitableVoiceActorName(name)).toBe(false);
  });

  it.each(["Jean-Pierre", "Hélène", "François Dupont", "Marie-Josée", "唐沢", "Doe"])(
    "accepts real name %s",
    (name) => {
      expect(isExploitableVoiceActorName(name)).toBe(true);
    },
  );
});
