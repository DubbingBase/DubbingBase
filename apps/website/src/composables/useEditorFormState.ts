import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from "vue";
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRouter,
  type RouteLocationNormalized,
} from "vue-router";

/**
 * Lifecycle of an editor form, from the user's point of view:
 * pristine → dirty → saving → saved, or saving → error (input stays dirty).
 */
export type EditorSaveStatus = "pristine" | "dirty" | "saving" | "saved" | "error";

type EditorSavePhase = "idle" | "saving" | "saved" | "error";

export interface EditorFormStateOptions<T> {
  /** Returns the persisted-relevant form values. Must be JSON serializable. */
  snapshot: () => T;
  /** Writes a previously captured snapshot back into the form. */
  restore: (value: T) => void;
}

export interface EditorFormState {
  status: ComputedRef<EditorSaveStatus>;
  isDirty: ComputedRef<boolean>;
  isSaving: ComputedRef<boolean>;
  errorMessage: Ref<string | null>;
  /** Records the current values as the persisted baseline (after load or reload). */
  markClean: () => void;
  beginSave: () => void;
  /** Marks the current values as persisted. Call only after the save succeeded. */
  saveSucceeded: () => void;
  /** Keeps the current values and dirty state, and exposes the failure. */
  saveFailed: (message: string) => void;
  /** Restores the last persisted baseline. */
  discard: () => void;
}

/**
 * Tracks dirty state against a serialized baseline snapshot so that failed saves never mark
 * the form clean and Discard always restores the last persisted values.
 */
export function createEditorFormState<T>(options: EditorFormStateOptions<T>): EditorFormState {
  const baseline = ref<string | null>(null);
  const phase = ref<EditorSavePhase>("idle");
  const errorMessage = ref<string | null>(null);

  const serialize = (): string => JSON.stringify(options.snapshot());

  const isDirty = computed(() => baseline.value !== null && serialize() !== baseline.value);

  const status = computed<EditorSaveStatus>(() => {
    if (phase.value === "saving") return "saving";
    if (phase.value === "error") return "error";
    if (isDirty.value) return "dirty";
    if (phase.value === "saved") return "saved";
    return "pristine";
  });

  const markClean = () => {
    baseline.value = serialize();
    if (phase.value === "error") {
      phase.value = "idle";
      errorMessage.value = null;
    }
  };

  const beginSave = () => {
    phase.value = "saving";
    errorMessage.value = null;
  };

  const saveSucceeded = () => {
    baseline.value = serialize();
    phase.value = "saved";
    errorMessage.value = null;
  };

  const saveFailed = (message: string) => {
    phase.value = "error";
    errorMessage.value = message;
  };

  const discard = () => {
    if (baseline.value === null) return;
    // JSON.parse returns `any`; the baseline was produced by serializing `snapshot()`.
    const persisted: T = JSON.parse(baseline.value);
    options.restore(persisted);
    phase.value = "idle";
    errorMessage.value = null;
  };

  return {
    status,
    isDirty,
    isSaving: computed(() => phase.value === "saving"),
    errorMessage,
    markClean,
    beginSave,
    saveSucceeded,
    saveFailed,
    discard,
  };
}

export interface UnsavedChangesLeaveGuard {
  /** Returns `false` and records the pending target when leaving would lose edits. */
  check: (to: RouteLocationNormalized) => boolean;
  /** Stays on the editor and keeps all edits. */
  stay: () => void;
  /** Returns the blocked target and lets the next navigation pass once. */
  confirmLeave: () => RouteLocationNormalized | null;
  isPrompting: Ref<boolean>;
}

/** Router-independent leave decision so it can be tested without a mounted router. */
export function createUnsavedChangesLeaveGuard(isDirty: () => boolean): UnsavedChangesLeaveGuard {
  const isPrompting = ref(false);
  let pendingTarget: RouteLocationNormalized | null = null;
  let allowNextNavigation = false;

  return {
    isPrompting,
    check(to) {
      if (allowNextNavigation) {
        allowNextNavigation = false;
        return true;
      }
      if (!isDirty()) return true;
      pendingTarget = to;
      isPrompting.value = true;
      return false;
    },
    stay() {
      pendingTarget = null;
      isPrompting.value = false;
    },
    confirmLeave() {
      const target = pendingTarget;
      pendingTarget = null;
      isPrompting.value = false;
      allowNextNavigation = target !== null;
      return target;
    },
  };
}

/**
 * Editor form state plus unsaved-change protection for route leave, project/language tab
 * switches (route updates) and browser unload.
 */
export function useEditorFormState<T>(options: EditorFormStateOptions<T>) {
  const form = createEditorFormState(options);
  const router = useRouter();
  const guard = createUnsavedChangesLeaveGuard(() => form.isDirty.value);

  onBeforeRouteLeave((to) => guard.check(to));
  onBeforeRouteUpdate((to) => guard.check(to));

  if (import.meta.client) {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!form.isDirty.value) return;
      event.preventDefault();
      // Legacy browsers require returnValue to be set to show the native prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    onBeforeUnmount(() => window.removeEventListener("beforeunload", onBeforeUnload));
  }

  const discardAndLeave = async () => {
    const target = guard.confirmLeave();
    if (target) await router.push(target.fullPath);
  };

  return {
    ...form,
    isLeavePromptOpen: guard.isPrompting,
    stayOnPage: guard.stay,
    discardAndLeave,
  };
}

let rowKeySequence = 0;

/** Client-only stable identity for editable rows; never sent to the save API. */
export function createEditorRowKey(): string {
  rowKeySequence += 1;
  return `row-${rowKeySequence}-${Math.random().toString(36).slice(2, 8)}`;
}
