import * as v from "valibot";
import { defineApiRoute } from "../../../../utils/api-v1/define";
import { requireMedia } from "../../../../utils/api-v1/credits";
import { mediaKey, mediaParams, apiMediaPath } from "../../../../utils/api-v1/media";
import { useSupabaseAdmin } from "../../../../utils/db/client";

const PAGE = 1000;

export const route = defineApiRoute({
  summary: "List the characters credited on a media entry",
  tags: ["Credits"],
  scope: "credits:read",
  params: mediaParams,
  query: v.object({}),
  response: v.object({
    path: v.string(),
    /** Character names as written on credits; the same name in several languages is one entry. */
    data: v.array(
      v.object({
        name: v.string(),
        game_character_id: v.nullable(v.string()),
        languages: v.array(v.string()),
        credits: v.number(),
      }),
    ),
  }),
  handler: async ({ event, params }) => {
    const key = mediaKey(params.type, params.id);
    await requireMedia(event, key);
    const supabase = useSupabaseAdmin(event);
    const { data: projects, error: projectError } = await supabase
      .from("dubbing_projects")
      .select("id, language")
      .eq("content_type", key.contentType)
      .eq("content_id", key.contentId);
    if (projectError) throw projectError;
    const languageOf = new Map((projects ?? []).map((project) => [project.id, project.language]));

    const groups = new Map<
      string,
      { name: string; game_character_id: string | null; languages: Set<string>; credits: number }
    >();
    if (languageOf.size > 0) {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("work")
          .select("dubbing_project_id, character_name, game_character_id")
          .in("dubbing_project_id", [...languageOf.keys()])
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        for (const row of data ?? []) {
          const name = row.character_name?.trim();
          if (!name) continue;
          const id = `${row.game_character_id ?? ""}|${name.toLowerCase()}`;
          const group = groups.get(id) ?? {
            name,
            game_character_id: row.game_character_id,
            languages: new Set<string>(),
            credits: 0,
          };
          const language = languageOf.get(row.dubbing_project_id);
          if (language) group.languages.add(language);
          group.credits += 1;
          groups.set(id, group);
        }
        if (!data || data.length < PAGE) break;
      }
    }
    if (key.contentType === "video_game") {
      // Characters registered for the game appear even before they have a credit.
      const { data, error } = await supabase
        .from("game_characters")
        .select("id, name")
        .eq("igdb_game_id", key.contentId);
      if (error) throw error;
      for (const character of data ?? []) {
        const id = `${character.id}|${character.name.trim().toLowerCase()}`;
        if (!groups.has(id)) {
          groups.set(id, {
            name: character.name.trim(),
            game_character_id: character.id,
            languages: new Set<string>(),
            credits: 0,
          });
        }
      }
    }
    return {
      path: `${apiMediaPath(key.segment, key.contentId)}/characters`,
      data: [...groups.values()]
        .map((group) => ({ ...group, languages: [...group.languages].sort() }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

export default route.handler;
