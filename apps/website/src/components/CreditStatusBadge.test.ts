import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import CreditStatusBadge from "./CreditStatusBadge.vue";

describe("CreditStatusBadge", () => {
  it("shows a verified icon for accepted credits", async () => {
    const wrapper = await mountSuspended(CreditStatusBadge, { props: { status: "accepted" } });
    const badge = wrapper.find('[data-testid="credit-status-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.attributes("aria-label")).toBeTruthy();
    expect(badge.classes()).toContain("text-app-success-text");
  });

  it("shows a warning icon for rejected credits", async () => {
    const wrapper = await mountSuspended(CreditStatusBadge, { props: { status: "rejected" } });
    const badge = wrapper.find('[data-testid="credit-status-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.classes()).toContain("text-app-warning-text");
  });

  it.each(["waiting", null, undefined])("renders nothing for %s", async (status) => {
    const wrapper = await mountSuspended(CreditStatusBadge, { props: { status } });
    expect(wrapper.find('[data-testid="credit-status-badge"]').exists()).toBe(false);
  });
});
