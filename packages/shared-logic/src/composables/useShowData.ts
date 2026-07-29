import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShowResponse } from "@supabase/functions/_shared/types";

export async function fetchShowData(supabase: SupabaseClient, id: string | number): Promise<ShowResponse | null> {
  const showResponseRaw = await supabase.functions.invoke<ShowResponse>("show", {
    body: { id },
  });

  const data = showResponseRaw.data;
  if (!data) {
    console.error("fetchShowData: Response is null", showResponseRaw);
    return null;
  }

  return data;
}
