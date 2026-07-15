import { createClient } from "@supabase/supabase-js";
import { Database } from "@/utils/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export { supabase };
