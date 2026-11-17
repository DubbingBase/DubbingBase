import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  type ComponentPublicInstance,
  type Ref,
} from "vue";
import { characterImageKey, type CharacterImageRequest } from "./useCharacterImages";

/** Activates a card's character lookup shortly before its containing element enters view. */
export function useCharacterImageViewport(requests: Ref<readonly CharacterImageRequest[]>) {
  const activatedKeys = ref(new Set<string>());
  const targets = new Map<Element, string[]>();
  let observer: IntersectionObserver | null = null;
  let mounted = false;

  const activeRequests = computed(() =>
    requests.value.filter((request) => {
      const key = characterImageKey(request);
      return key !== null && activatedKeys.value.has(key);
    }),
  );

  function observe(targetRequests: readonly CharacterImageRequest[]) {
    const keys = [...new Set(targetRequests.map(characterImageKey).filter((key) => key !== null))];
    let target: Element | null = null;

    return (nextTarget: Element | ComponentPublicInstance | null) => {
      if (target) {
        observer?.unobserve(target);
        targets.delete(target);
      }
      target = typeof Element !== "undefined" && nextTarget instanceof Element ? nextTarget : null;
      if (!target) return;
      const inactiveKeys = keys.filter((key) => !activatedKeys.value.has(key));
      if (inactiveKeys.length === 0) return;
      targets.set(target, inactiveKeys);
      if (observer) observer.observe(target);
      else if (mounted) for (const key of inactiveKeys) activatedKeys.value.add(key);
    };
  }

  onMounted(() => {
    mounted = true;
    if (typeof IntersectionObserver === "undefined") {
      activatedKeys.value = new Set(
        requests.value.map(characterImageKey).filter((key) => key !== null),
      );
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          for (const key of targets.get(entry.target) ?? []) activatedKeys.value.add(key);
          targets.delete(entry.target);
          observer?.unobserve(entry.target);
        }
      },
      { rootMargin: "400px" },
    );
    for (const target of targets.keys()) observer.observe(target);
  });

  onBeforeUnmount(() => observer?.disconnect());

  return { activeRequests, observe };
}
