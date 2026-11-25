import { eqMediaRef, MEDIA_FILTER_EMBED } from "@app/shared-logic";
import * as v from "valibot";
import { defineApiRoute } from "../../../../utils/api-v1/define";
import { MEDIA_NOT_FOUND_DESCRIPTION, requireMedia } from "../../../../utils/api-v1/credits";
import { mediaKey, mediaParams, apiMediaPath } from "../../../../utils/api-v1/media";
import { useSupabaseAdmin } from "../../../../utils/db/client";

const PAGE = 1000;

export const route = defineApiRoute({
  summary: "List the characters credited on a media entry",
  tags: ["Credits"],
  scope: "characters:read",
  notFound: MEDIA_NOT_FOUND_DESCRIPTION,
  params: mediaParams,
  query: v.object({}),
  response: v.object({
    path: v.string(),
    /** Character names as written on credits; the same name in several languages is one entry. */
    data: v.array(
      v.object({
        name: v.string(),
        game_character_id: v.nullable(v.string()),
        /** The IGDB character this game character is linked to, if any (games only). */
        igdb_character_id: v.nullable(v.number()),
        wikidata_qid: v.nullable(v.string()),
        languages: v.array(v.string()),
        credits: v.number(),
      }),
    ),
  }),
  handler: async ({ event, params }) => {
    const key = mediaKey(params.type, params.id);
    await requireMedia(event, key);
    const supabase = useSupabaseAdmin(event);
    const { data: projects, error: projectError } = await eqMediaRef(
      supabase.from("dubbing_projects").select(`id, language, ${MEDIA_FILTER_EMBED}`),
      key.contentType,
      key.contentId,
    );
    if (projectError) throw projectError;
    const languageOf = new Map((projects ?? []).map((project) => [project.id, project.language]));

    const groups = new Map<
      string,
      {
        name: string;
        game_character_id: string | null;
        igdb_character_id: number | null;
        wikidata_qid: string | null;
        languages: Set<string>;
        credits: number;
      }
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
          const name = row.character_name?.trim() ?? "";
          // A game credit is identified by its registered character even when it has no name.
          if (!name && !row.game_character_id) continue;
          const id = row.game_character_id ?? `|${name.toLowerCase()}`;
          const group = groups.get(id) ?? {
            name,
            game_character_id: row.game_character_id,
            igdb_character_id: null,
            wikidata_qid: null,
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
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await eqMediaRef(
          supabase
            .from("game_characters")
            .select(`id, name, igdb_character_id, wikidata_qid, ${MEDIA_FILTER_EMBED}`),
          key.contentType,
          key.contentId,
        )
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        for (const character of data ?? []) {
          const group = groups.get(character.id);
          if (group) {
            if (!group.name) group.name = character.name.trim();
            group.igdb_character_id = character.igdb_character_id;
            group.wikidata_qid = character.wikidata_qid;
            continue;
          }
          groups.set(character.id, {
            name: character.name.trim(),
            game_character_id: character.id,
            igdb_character_id: character.igdb_character_id,
            wikidata_qid: character.wikidata_qid,
            languages: new Set<string>(),
            credits: 0,
          });
        }
        if (!data || data.length < PAGE) break;
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
