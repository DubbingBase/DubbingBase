import { describe, expect, it } from "vitest";
import { computeKeyboardInset } from "./useKeyboardInset";

describe("computeKeyboardInset", () => {
  it("returns the hidden height when the keyboard is open", () => {
    expect(computeKeyboardInset(800, 480, 0)).toBe(320);
  });
  it("ignores small browser-chrome resizes and pinch-zoom offsets", () => {
    expect(computeKeyboardInset(800, 760, 0)).toBe(0);
    expect(computeKeyboardInset(800, 800, 0)).toBe(0);
  });
  it("accounts for the visual viewport scrolled within the layout viewport", () => {
    expect(computeKeyboardInset(800, 480, 100)).toBe(220);
  });
});
