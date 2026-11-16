import { describe, expect, it, vi } from "vitest";
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { createError, defineEventHandler } from "h3";
import EntityHistory from "./EntityHistory.vue";

let revertCalls = 0;

registerEndpoint(
  "/api/entity-history",
  defineEventHandler(() => ({
    canRevert: true,
    entries: [
      {
        id: "1",
        createdAt: new Date().toISOString(),
        action: "update",
        contributor: "Ann",
        kind: "edited",
        important: false,
        target: "profile",
        label: null,
        href: null,
        reverted: false,
        revertable: true,
        revertBlockedReason: null,
        changes: [
          {
            field: "bio",
            importance: "normal",
            type: "text",
            before: "a",
            after: "b",
            beforeHref: null,
            afterHref: null,
          },
        ],
      },
    ],
  })),
);

registerEndpoint(
  "/api/revert-history-entry",
  defineEventHandler(() => {
    revertCalls += 1;
    throw createError({ statusCode: 409, statusMessage: "changed" });
  }),
);

describe("EntityHistory revert", () => {
  it("needs a confirmation click before reverting and shows the conflict inline", async () => {
    const wrapper = await mountSuspended(EntityHistory, {
      props: { type: "voice_actor", entityId: 1, entityName: "Test" },
      attachTo: document.body,
    });
    await wrapper.get("[data-testid=history-trigger]").trigger("click");
    await vi.waitFor(() =>
      expect(document.querySelector("[data-testid=history-revert]")).toBeTruthy(),
    );

    document.querySelector<HTMLElement>("[data-testid=history-revert]")?.click();
    await flushPromises();
    expect(revertCalls).toBe(0);
    expect(document.querySelector("[data-testid=history-revert-confirm]")).toBeTruthy();

    document.querySelector<HTMLElement>("[data-testid=history-revert-confirm]")?.click();
    await vi.waitFor(() =>
      expect(document.querySelector("[data-testid=history-revert-error]")).toBeTruthy(),
    );
    expect(revertCalls).toBe(1);
    wrapper.unmount();
  });
});
