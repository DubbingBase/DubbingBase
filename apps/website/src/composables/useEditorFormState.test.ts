import { describe, expect, it } from "vitest";
import { ref } from "vue";
import type { RouteLocationNormalized } from "vue-router";
import {
  createEditorFormState,
  createEditorRowKey,
  createUnsavedChangesLeaveGuard,
} from "./useEditorFormState";

const emptyRoute: RouteLocationNormalized = {
  fullPath: "/",
  path: "/",
  name: undefined,
  params: {},
  query: {},
  hash: "",
  matched: [],
  meta: {},
  redirectedFrom: undefined,
};

const makeForm = () => {
  const name = ref("persisted");
  const rows = ref([{ key: "a", note: "one" }]);
  const form = createEditorFormState({
    snapshot: () => ({ name: name.value, rows: rows.value }),
    restore: (saved) => {
      name.value = saved.name;
      rows.value = saved.rows;
    },
  });
  form.markClean();
  return { name, rows, form };
};

const target = (fullPath: string): RouteLocationNormalized => ({
  ...emptyRoute,
  fullPath,
  path: fullPath,
});

describe("createEditorFormState", () => {
  it("starts pristine and becomes dirty on edit, including nested rows", () => {
    const { name, rows, form } = makeForm();
    expect(form.status.value).toBe("pristine");

    name.value = "changed";
    expect(form.isDirty.value).toBe(true);
    expect(form.status.value).toBe("dirty");

    name.value = "persisted";
    expect(form.isDirty.value).toBe(false);

    rows.value[0].note = "two";
    expect(form.isDirty.value).toBe(true);
  });

  it("does not mark the form clean when a save fails and keeps the input", () => {
    const { name, form } = makeForm();
    name.value = "unsaved";
    form.beginSave();
    expect(form.status.value).toBe("saving");

    form.saveFailed("Conflict");
    expect(form.status.value).toBe("error");
    expect(form.errorMessage.value).toBe("Conflict");
    expect(form.isDirty.value).toBe(true);
    expect(name.value).toBe("unsaved");
  });

  it("resets dirty state after a successful save and reports saved", () => {
    const { name, form } = makeForm();
    name.value = "next";
    form.beginSave();
    form.saveSucceeded();

    expect(form.isDirty.value).toBe(false);
    expect(form.status.value).toBe("saved");
    expect(form.errorMessage.value).toBeNull();

    name.value = "after-save";
    expect(form.status.value).toBe("dirty");
  });

  it("recovers from an error with a later successful save", () => {
    const { name, form } = makeForm();
    name.value = "x";
    form.beginSave();
    form.saveFailed("boom");
    form.beginSave();
    form.saveSucceeded();
    expect(form.status.value).toBe("saved");
    expect(form.errorMessage.value).toBeNull();
  });

  it("discard restores persisted values, including removed and added rows", () => {
    const { name, rows, form } = makeForm();
    name.value = "edited";
    rows.value = [];
    rows.value.push({ key: "z", note: "new" });

    form.discard();

    expect(name.value).toBe("persisted");
    expect(rows.value).toEqual([{ key: "a", note: "one" }]);
    expect(form.status.value).toBe("pristine");
  });

  it("discard after a failed save clears the error", () => {
    const { name, form } = makeForm();
    name.value = "edited";
    form.saveFailed("nope");
    form.discard();
    expect(form.status.value).toBe("pristine");
    expect(form.errorMessage.value).toBeNull();
  });
});

describe("createUnsavedChangesLeaveGuard", () => {
  it("allows navigation when clean", () => {
    const guard = createUnsavedChangesLeaveGuard(() => false);
    expect(guard.check(target("/movie/1"))).toBe(true);
    expect(guard.isPrompting.value).toBe(false);
  });

  it("blocks and prompts when dirty; Cancel keeps the user in place", () => {
    const guard = createUnsavedChangesLeaveGuard(() => true);
    expect(guard.check(target("/movie/2/projects/9/edit"))).toBe(false);
    expect(guard.isPrompting.value).toBe(true);

    guard.stay();
    expect(guard.isPrompting.value).toBe(false);
    expect(guard.confirmLeave()).toBeNull();
  });

  it("Discard returns the blocked target and lets that navigation through once", () => {
    const guard = createUnsavedChangesLeaveGuard(() => true);
    const to = target("/movie/2/projects/9/edit");
    guard.check(to);

    expect(guard.confirmLeave()).toBe(to);
    expect(guard.isPrompting.value).toBe(false);
    expect(guard.check(to)).toBe(true);
    // The allowance is consumed; a later dirty navigation prompts again.
    expect(guard.check(to)).toBe(false);
  });
});

describe("createEditorRowKey", () => {
  it("returns unique keys", () => {
    const keys = new Set(Array.from({ length: 200 }, () => createEditorRowKey()));
    expect(keys.size).toBe(200);
  });
});
