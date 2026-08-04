export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter();

  router.onError((error, to) => {
    const isChunkError =
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Importing a module script failed") ||
      error.message.includes("dynamically imported module");

    if (isChunkError) {
      console.warn(
        "Chunk loading failed (likely due to a new deployment). Reloading page...",
      );
      window.location.href = to.fullPath;
    }
  });
});
