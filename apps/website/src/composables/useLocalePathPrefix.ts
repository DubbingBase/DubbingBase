import { computed } from "vue";

export function useLocalePathPrefix(): (path: string) => string {
  const localePath = useLocalePath();
  const prefix = computed(() => {
    const localizedRoot = localePath("/");
    return localizedRoot === "/" ? "" : localizedRoot.replace(/\/$/, "");
  });

  return (path: string) => {
    if (path === "/") return prefix.value || "/";
    return `${prefix.value}${path}`;
  };
}
