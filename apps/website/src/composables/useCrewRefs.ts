import { computed, type Ref } from "vue";

/** Binds named crew refs to the value/update contract of the shared crew card. */
export const useCrewRefs = (refs: Record<string, Ref<number | null>>) => ({
  crewValues: computed(() =>
    Object.fromEntries(Object.entries(refs).map(([key, target]) => [key, target.value])),
  ),
  setCrewMember: (key: string, value: number | null) => {
    const target = refs[key];
    if (target) target.value = value;
  },
});
