import { onBeforeUnmount, onMounted, readonly, ref } from "vue";

/** Keyboards shorter than this are treated as browser chrome changes, not an on-screen keyboard. */
const KEYBOARD_THRESHOLD_PX = 120;

/** Pure helper: height of the area at the bottom of the layout viewport hidden by the keyboard. */
export const computeKeyboardInset = (
  layoutHeight: number,
  visualHeight: number,
  visualOffsetTop: number,
): number => {
  const inset = Math.round(layoutHeight - visualHeight - visualOffsetTop);
  return inset > KEYBOARD_THRESHOLD_PX ? inset : 0;
};

/**
 * Tracks the on-screen keyboard through the Visual Viewport API and exposes it as the
 * `--keyboard-inset` CSS variable so sticky/fixed bars can stay above it. While a field is
 * focused it is scrolled into the visible area once the keyboard has opened.
 */
export const useKeyboardInset = () => {
  const inset = ref(0);

  const apply = () => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    inset.value = computeKeyboardInset(window.innerHeight, viewport.height, viewport.offsetTop);
    document.documentElement.style.setProperty("--keyboard-inset", `${inset.value}px`);
  };

  const revealFocused = () => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || !el.matches("input, textarea, select")) return;
    if (inset.value === 0) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const onFocusIn = () => {
    // The keyboard animates in after focus; wait for the viewport resize to settle.
    window.setTimeout(() => {
      apply();
      revealFocused();
    }, 250);
  };

  onMounted(() => {
    apply();
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    document.addEventListener("focusin", onFocusIn);
  });

  onBeforeUnmount(() => {
    window.visualViewport?.removeEventListener("resize", apply);
    window.visualViewport?.removeEventListener("scroll", apply);
    document.removeEventListener("focusin", onFocusIn);
    document.documentElement.style.removeProperty("--keyboard-inset");
  });

  return readonly(inset);
};
