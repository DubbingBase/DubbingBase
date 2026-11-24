import { eqMediaRef, MEDIA_FILTER_EMBED } from "@app/shared-logic";
import type { MediaKind } from "@app/shared-logic";
import type { EditorProjectTab } from "~/utils/admin-project-editor-types";

/** Row shape selected by `fetchProjectTabs`. */
export type ProjectTabRow = EditorProjectTab & { studio_id: number | null };

/** Dubbing projects of a media (provider reference), as listed in the editors' language tabs. */
export function useDubbingProjectTabs() {
  const supabase = useSupabaseClient();

  async function fetchProjectTabs(kind: MediaKind, contentId: number): Promise<ProjectTabRow[]> {
    const { data } = await eqMediaRef(
      supabase
        .from("dubbing_projects")
        .select(`id, language, studio_id, studios(name), ${MEDIA_FILTER_EMBED}`),
      kind,
      contentId,
    );
    return (data ?? []).map((row) => ({
      id: row.id,
      language: row.language,
      studio_id: row.studio_id,
      studios: row.studios,
    }));
  }

  return { fetchProjectTabs };
}
