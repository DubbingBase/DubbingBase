import { createClient } from "@supabase/supabase-js";
import { Database } from "@app/supabase/functions/_shared/database.types";
import { isTauri } from "@/utils/tauri";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const createBaseClient = (user?: string | null) => {
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: {
            fetch: isTauri ? fetch : undefined,
            headers: user
                ? {
                    Authorization: user,
                }
                : {},
        },
    });
};

const supabase = createBaseClient();
// const supaUser = (user?: string | null) => createBaseClient(user);

export { supabase };
