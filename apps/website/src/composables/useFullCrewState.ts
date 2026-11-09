import { computed, ref, type Ref } from "vue";
import type { CrewFieldDefinition } from "~/components/admin/ProjectCrewCard.vue";

/** `jobs.id` of each crew role stored in `dubbing_project_crew`. */
export const FULL_CREW_JOBS = {
  artisticDirector: 1,
  adaptation: 2,
  recording: 3,
  editing: 4,
  mixing: 5,
  projectManager: 6,
  creativeSupervision: 7,
} as const;

export type FullCrewKey = keyof typeof FULL_CREW_JOBS;
export type FullCrewSnapshot = Record<FullCrewKey, number | null>;

const CREW_KEYS = Object.keys(FULL_CREW_JOBS).filter(
  (key): key is FullCrewKey => key in FULL_CREW_JOBS,
);

/**
 * The seven-role crew (direction, adaptation, sound, mixing, management, supervision)
 * shared by the movie, show and game editors.
 */
export const useFullCrewState = (t: (key: string) => string) => {
  const refs: Record<FullCrewKey, Ref<number | null>> = {
    artisticDirector: ref(null),
    adaptation: ref(null),
    recording: ref(null),
    editing: ref(null),
    mixing: ref(null),
    projectManager: ref(null),
    creativeSupervision: ref(null),
  };

  const fields = computed<CrewFieldDefinition[]>(() => [
    { key: "artisticDirector", label: t("admin.movieEditor.artisticDirector") },
    { key: "adaptation", label: t("admin.movieEditor.adaptation") },
    { key: "recording", label: t("admin.movieEditor.soundRecording") },
    { key: "editing", label: t("admin.movieEditor.soundEditing") },
    { key: "mixing", label: t("dubbing.mixing") },
    { key: "projectManager", label: t("admin.movieEditor.projectManager") },
    { key: "creativeSupervision", label: t("admin.movieEditor.creativeSupervision") },
  ]);

  const values = computed(() => Object.fromEntries(CREW_KEYS.map((key) => [key, refs[key].value])));
  const set = (key: string, value: number | null) => {
    for (const known of CREW_KEYS) if (known === key) refs[known].value = value;
  };

  const snapshot = (): FullCrewSnapshot => ({
    artisticDirector: refs.artisticDirector.value,
    adaptation: refs.adaptation.value,
    recording: refs.recording.value,
    editing: refs.editing.value,
    mixing: refs.mixing.value,
    projectManager: refs.projectManager.value,
    creativeSupervision: refs.creativeSupervision.value,
  });
  const restore = (saved: FullCrewSnapshot) => {
    for (const key of CREW_KEYS) refs[key].value = saved[key];
  };

  /** Replaces every role: roles absent from `rows` are cleared. */
  const load = (rows: { job_id: number; person_id: number }[]) => {
    for (const key of CREW_KEYS) refs[key].value = null;
    for (const row of rows) {
      for (const key of CREW_KEYS) {
        if (FULL_CREW_JOBS[key] === row.job_id) refs[key].value = row.person_id;
      }
    }
  };

  const toSaveRows = (): { job_id: number; person_id: number }[] =>
    CREW_KEYS.flatMap((key) => {
      const personId = refs[key].value;
      return personId === null ? [] : [{ job_id: FULL_CREW_JOBS[key], person_id: personId }];
    });

  return { fields, values, set, snapshot, restore, load, toSaveRows };
};
