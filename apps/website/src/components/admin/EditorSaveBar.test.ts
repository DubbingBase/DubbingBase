import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EditorSaveBar from "./EditorSaveBar.vue";
import type { EditorSaveStatus } from "~/composables/useEditorFormState";

const mountBar = (status: EditorSaveStatus, isDirty: boolean, errorMessage: string | null = null) =>
  mountSuspended(EditorSaveBar, {
    props: {
      status,
      isDirty,
      errorMessage,
      saveLabel: "Save project",
      formId: "project-form",
    },
  });

describe("EditorSaveBar", () => {
  it("is sticky and ties the submit button to the editor form", async () => {
    const wrapper = await mountBar("pristine", false);
    expect(wrapper.get("[data-testid=editor-save-bar]").classes()).toContain("sticky");
    expect(wrapper.get("[data-testid=editor-save]").attributes("form")).toBe("project-form");
    expect(wrapper.get("[data-testid=editor-save]").attributes("type")).toBe("submit");
  });

  it("disables Discard until there are changes", async () => {
    const clean = await mountBar("pristine", false);
    expect(clean.get("[data-testid=editor-discard]").attributes("disabled")).toBeDefined();

    const dirty = await mountBar("dirty", true);
    expect(dirty.get("[data-testid=editor-discard]").attributes("disabled")).toBeUndefined();
  });

  it("announces saving politely and locks both actions", async () => {
    const wrapper = await mountBar("saving", true);
    const status = wrapper.get("[data-testid=editor-save-status]");
    expect(status.attributes("role")).toBe("status");
    expect(status.attributes("aria-live")).toBe("polite");
    expect(wrapper.get("[data-testid=editor-save]").attributes("disabled")).toBeDefined();
    expect(wrapper.get("[data-testid=editor-save]").attributes("aria-busy")).toBe("true");
    expect(wrapper.get("[data-testid=editor-discard]").attributes("disabled")).toBeDefined();
  });

  it("exposes failures as an alert and keeps Save and Discard available", async () => {
    const wrapper = await mountBar("error", true, "Project was changed elsewhere");
    const status = wrapper.get("[data-testid=editor-save-status]");
    expect(status.attributes("role")).toBe("alert");
    expect(status.text()).toContain("Project was changed elsewhere");
    expect(wrapper.get("[data-testid=editor-save]").attributes("disabled")).toBeUndefined();
    expect(wrapper.get("[data-testid=editor-discard]").attributes("disabled")).toBeUndefined();
  });

  it("emits discard", async () => {
    const wrapper = await mountBar("dirty", true);
    await wrapper.get("[data-testid=editor-discard]").trigger("click");
    expect(wrapper.emitted("discard")).toHaveLength(1);
  });
});
