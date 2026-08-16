import { invalidateMediaClientCache } from "../composables/useClientDataCache";

// Lets any client-side media mutation (vote, link voice actor, review status,
// etc.) drop the matching client SWR entry so the next navigation revalidates
// from the freshly purged edge cache. Mutation components just dispatch:
//   window.dispatchEvent(new CustomEvent("media-cache:invalidate", {
//     detail: { type: "movie" | "tv" | "game", id }
//   }));
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    window.addEventListener("media-cache:invalidate", (event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail;
      if (
        detail &&
        typeof detail === "object" &&
        "type" in detail &&
        "id" in detail
      ) {
        invalidateMediaClientCache(detail.type, detail.id);
      }
    });
  }
});
