import type { SupabaseClient } from "@supabase/supabase-js";
import type { TVDetailResponse } from "@supabase/functions/_shared/types";

export async function fetchShowData(
  supabase: SupabaseClient,
  id: string | number,
  locale?: string,
): Promise<TVDetailResponse | null> {
  const headers: Record<string, string> = {};
  if (locale) {
    headers["Accept-Language"] = locale;
  }

  const showResponseRaw = await supabase.functions.invoke<TVDetailResponse>(
    "show",
    {
      body: { id },
      headers,
    },
  );

  const data = showResponseRaw.data;
  if (!data) {
    console.error("fetchShowData: Response is null", showResponseRaw);
    return null;
  }

  return data;
}
