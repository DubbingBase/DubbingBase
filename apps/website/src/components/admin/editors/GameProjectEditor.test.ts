import { mockNuxtImport, mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { createError, readBody } from "h3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GameProjectEditor from "./GameProjectEditor.vue";

const { loadProject, saveProject } = vi.hoisted(() => ({
  loadProject: vi.fn(),
  saveProject: vi.fn<(body: unknown) => Promise<unknown>>(),
}));

vi.mock("~/middleware/admin", () => ({ default: () => undefined }));

mockNuxtImport("useSupabaseClient", () => () => ({
  from: () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      limit: () => builder,
      single: loadProject,
      then: (resolve: (result: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }),
    };
    return builder;
  },
}));

const gameData = {
  game: { name: "Fixture Game" },
  characters: [],
  character_catalog_status: "unavailable",
};

const createCharacter = vi.fn();
registerEndpoint("/api/game/42", () => gameData);
registerEndpoint("/api/game-characters", { method: "POST", handler: createCharacter });
registerEndpoint("/api/save-dubbing-project", {
  method: "POST",
  handler: async (event) => saveProject(await readBody(event)),
});

const characterInput = 'input[placeholder="Search game character..."]';

async function mountEditor() {
  return mountSuspended(GameProjectEditor, { route: "/game/42/projects/51/edit" });
}

async function createDraft(wrapper: Awaited<ReturnType<typeof mountEditor>>) {
  await wrapper.get('[data-testid="add-cast-row"]').trigger("click");
  const input = wrapper.get(characterInput);
  await input.setValue("Draft Role");
  await input.trigger("focus");
  const create = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === "Create “Draft Role”",
  );
  expect(create).toBeDefined();
  create?.click();
  await flushPromises();
}

describe("Game project draft characters", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadProject.mockResolvedValue({
      data: {
        id: 51,
        content_id: 42,
        content_type: "video_game",
        language: "fr-FR",
        status: "draft",
        studio_id: null,
        updated_at: "2026-11-22T00:00:00",
        work: [],
      },
      error: null,
    });
  });

  it("makes a draft available across cast rows and removes it on discard", async () => {
    const wrapper = await mountEditor();
    await createDraft(wrapper);

    await wrapper.get('[data-testid="add-cast-row"]').trigger("click");
    const secondCharacter = wrapper.get(characterInput);
    await secondCharacter.trigger("focus");
    await secondCharacter.trigger("keydown", { key: "ArrowDown" });
    await secondCharacter.trigger("keydown", { key: "Enter" });
    expect(wrapper.findAll('[data-testid="cast-row"]').map((row) => row.text())).toEqual([
      expect.stringContaining("Draft Role"),
      expect.stringContaining("Draft Role"),
    ]);
    expect(saveProject).not.toHaveBeenCalled();
    expect(createCharacter).not.toHaveBeenCalled();

    await wrapper.get('[data-testid="editor-discard"]').trigger("click");
    await wrapper.get('[data-testid="add-cast-row"]').trigger("click");
    await wrapper.get(characterInput).trigger("focus");
    expect(document.body.textContent).not.toContain("Draft Role");
    wrapper.unmount();
  });

  it("keeps drafts after a rejected save and reports a reload failure after a successful retry", async () => {
    const wrapper = await mountEditor();
    await createDraft(wrapper);
    saveProject.mockRejectedValueOnce(
      createError({ statusCode: 422, statusMessage: "Save was rejected" }),
    );
    await wrapper.get("#game-project-form").trigger("submit");
    await flushPromises();

    expect(wrapper.get('[data-testid="editor-save-status"]').text()).toContain("Save was rejected");
    expect(wrapper.get('[data-testid="cast-row"]').text()).toContain("Draft Role");
    const firstSave = saveProject.mock.calls[0]?.[0];
    expect(firstSave).toMatchObject({
      new_game_characters: expect.any(Object),
      cast: [expect.objectContaining({ character_name: "Draft Role" })],
    });

    saveProject.mockResolvedValueOnce({ projectId: 51, updatedAt: "2026-11-22T01:00:00" });
    loadProject.mockResolvedValueOnce({ data: null, error: new Error("Reload failed") });
    await wrapper.get("#game-project-form").trigger("submit");

    await vi.waitFor(() =>
      expect(wrapper.text()).toContain(
        "The project was saved. Reload this page to continue editing.",
      ),
    );
    expect(saveProject.mock.calls[1]?.[0]).toEqual(firstSave);
    wrapper.unmount();
  });
});
