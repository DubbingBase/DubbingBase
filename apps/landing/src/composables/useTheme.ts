import { computed, onMounted, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";

type Theme = "dark" | "light" | "system";

export function useTheme() {
  const theme = useLocalStorage<Theme>("dubbingbase-theme", "system");

  const getSystemTheme = () => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  };

  const effectiveTheme = computed(() => {
    if (theme.value === "system") return getSystemTheme();
    return theme.value;
  });

  const applyTheme = () => {
    document.documentElement.setAttribute("data-theme", effectiveTheme.value);
  };

  const toggleTheme = () => {
    const cycle: Theme[] = ["system", "dark", "light"];
    const currentIndex = cycle.indexOf(theme.value);
    const nextIndex = (currentIndex + 1) % cycle.length;
    theme.value = cycle[nextIndex];
    applyTheme();
  };

  watch(theme, applyTheme);

  onMounted(() => {
    applyTheme();

    window
      .matchMedia("(prefers-color-scheme: light)")
      .addEventListener("change", () => {
        if (theme.value === "system") {
          applyTheme();
        }
      });
  });

  return { theme, toggleTheme, applyTheme, effectiveTheme };
}
