import { computed, ref, type Ref } from "vue";
import type { AdminLookups } from "~/composables/useAdminLookups";
import { createEditorRowKey } from "~/composables/useEditorFormState";
import type { EditorCastRowBase } from "~/utils/admin-project-editor-types";
import type { CastWorkspaceRow } from "~/utils/cast-workspace";

/**
 * Cast workspace state for media that only record a role and a voice actor
 * (audiobooks, podcasts, toys, advertisements).
 */
export const useSimpleCastWorkspace = (
  castList: Ref<EditorCastRowBase[]>,
  lookups: AdminLookups,
  defaults: { characterName: string; performance: string },
) => {
  const selectedKey = ref<string | null>(null);
  const selectedRow = computed(
    () => castList.value.find((row) => row.key === selectedKey.value) ?? null,
  );
  const castView = computed<CastWorkspaceRow[]>(() =>
    castList.value.map((row) => ({
      key: row.key,
      characterName: row.character_name,
      characterImage: null,
      originalActorName: "",
      originalActorImage: null,
      voiceActorName: row.voice_actor_id ? lookups.voiceActorLabel(row.voice_actor_id) : "",
      voiceActorImage: lookups.voiceActorImage(row.voice_actor_id),
      assigned: row.voice_actor_id !== null,
      performance: row.performance,
      highlight: false,
    })),
  );
  const addRow = () => {
    const key = createEditorRowKey();
    castList.value.push({
      key,
      voice_actor_id: null,
      character_name: defaults.characterName,
      performance: defaults.performance,
      note: "",
    });
    selectedKey.value = key;
  };
  const removeRow = (key: string) => {
    castList.value = castList.value.filter((row) => row.key !== key);
    if (selectedKey.value === key) selectedKey.value = null;
  };
  return { selectedKey, selectedRow, castView, addRow, removeRow };
};
