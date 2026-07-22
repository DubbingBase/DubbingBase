import { createClient } from "@supabase/supabase-js";
import { Database } from "@/utils/database";
import { toastController } from "@/composables/useToast";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

const originalInvoke = supabase.functions.invoke.bind(supabase.functions);

supabase.functions.invoke = async <T = any>(
  functionName: string,
  options?: any,
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
  } catch (err: any) {
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
