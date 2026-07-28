import { createClient } from "@supabase/supabase-js";
import type { Database } from "@app/shared-logic";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "anon-key";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
