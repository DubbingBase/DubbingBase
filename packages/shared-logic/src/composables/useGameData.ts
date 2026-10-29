import type { IgdbCharacter, IgdbGame } from "../types";

interface GamePageDubbingProject {
  id: number;
  language?: string | null;
  works?:
    | {
        actor_id: number | null;
        character_id: number | null;
        character_name: string | null;
        voice_actor?: {
          id: number | null;
          firstname: string | null;
          lastname: string | null;
          profile_picture: string | null;
        } | null;
      }[]
    | null;
  studio_data?: { id: number; name: string | null; logo_url: string | null } | null;
}

interface GamePageData {
  game: IgdbGame | null;
  characters: IgdbCharacter[];
  dubbingProjects: GamePageDubbingProject[];
}

export async function fetchGameData(
  id: string | number,
  locale?: string,
  projection?: "media-page",
): Promise<GamePageData | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  try {
    const data = await $fetch<GamePageData>(`/api/game/${id}`, {
      headers,
      ...(projection ? { query: { projection } } : {}),
    });
    if (!data || !data.game) {
      console.error("fetchGameData: Response is null or missing game property");
      return null;
    }
    return data;
  } catch (e) {
    console.error("fetchGameData error:", e);
    return null;
  }
}
