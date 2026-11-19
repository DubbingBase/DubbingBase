import { resolveMediaImage, type MediaImageOptions } from "@app/shared-logic";

export function useMediaImage() {
  const { supabaseUrl } = useRuntimeConfig().public;
  const storageBase = import.meta.dev ? "/supabase" : (supabaseUrl ?? "");

  return (image: string | null | undefined, options?: Omit<MediaImageOptions, "storageBase">) =>
    resolveMediaImage(image, { ...options, storageBase }) ?? undefined;
}
