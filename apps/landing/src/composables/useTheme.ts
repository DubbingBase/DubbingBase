import { computed, onMounted } from "vue";

type Theme = "dark" | "light" | "system";

export function useTheme() {
  const theme = useCookie<Theme>("dubbingbase-theme", {
    default: () => "system",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
    watch: true, // ensure reactivity across tabs if needed
  });

  const getSystemTheme = () => {
    if (typeof window === "undefined") return "dark"; // Default SSR assumption
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  };

  const effectiveTheme = computed(() => {
    if (theme.value === "system") return getSystemTheme();
    return theme.value;
  });

  const toggleTheme = () => {
    const cycle: Theme[] = ["system", "dark", "light"];
    const currentIndex = cycle.indexOf(theme.value);
    const nextIndex = (currentIndex + 1) % cycle.length;
    theme.value = cycle[nextIndex]!;
  };

  // Keep system theme responsive to OS changes
  onMounted(() => {
    window
      .matchMedia("(prefers-color-scheme: light)")
      .addEventListener("change", () => {
        // Trigger reactivity by touching the theme ref, or use a separate ref for system theme.
        // Actually, effectiveTheme won't automatically re-compute when system preference changes
        // unless we make getSystemTheme reactive.
        if (theme.value === "system") {
          document.documentElement.setAttribute("data-theme", getSystemTheme());
        }
      });
  });

  return { theme, toggleTheme, effectiveTheme };
}
