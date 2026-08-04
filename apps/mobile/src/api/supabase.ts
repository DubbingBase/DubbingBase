import { createClient } from "@supabase/supabase-js";
import { Database } from "@/utils/database";
import { toastController } from "@/composables/useToast";

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (import.meta.env.DEV) {
  // En mode dev, on route les requêtes vers le proxy Vite pour que ça marche avec --host ou le live reload Capacitor
  if (
    window.location.origin &&
    window.location.origin !== "null" &&
    !window.location.origin.includes("capacitor://")
  ) {
    supabaseUrl = `${window.location.origin}/supabase-api`;
  }
}

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

const originalInvoke = supabase.functions.invoke.bind(supabase.functions);

supabase.functions.invoke = async <T = unknown>(
  functionName: string,
  options?: Parameters<typeof originalInvoke>[1],
) => {
  try {
    const result = await originalInvoke<T>(functionName, options);
    if (result.error) {
      console.error(`Edge function error (${functionName}):`, result.error);
      const toast = await toastController.create({
        message: `Failed to execute ${functionName}: ${result.error.message || result.error}`,
        duration: 3000,
        color: "danger",
      });
      toast.present();
    }
    return result;
  } catch (err: unknown) {
    console.error(`Edge function exception (${functionName}):`, err);
    const toast = await toastController.create({
      message: `Failed to execute ${functionName}: ${err.message || "Unknown error"}`,
      duration: 3000,
      color: "danger",
    });
    toast.present();
    throw err;
  }
};

export { supabase };
