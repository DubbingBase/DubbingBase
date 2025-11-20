import { createClient } from "@supabase/supabase-js";
import { Database } from "@app/supabase/functions/_shared/database.types";
import { fetch } from "@tauri-apps/plugin-http";
import { isTauri } from "@/utils/tauri";

import { debug, error, info, trace, warn } from "@tauri-apps/plugin-log";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (isTauri) {
    info("meta:" + JSON.stringify(import.meta));
    info("supabaseUrl:" + supabaseUrl);
    info("isTauri:" + isTauri);
}

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
