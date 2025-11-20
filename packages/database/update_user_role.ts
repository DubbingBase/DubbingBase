// deno-lint-ignore-file no-explicit-any
/**
 * CLI script to update a user's app_metadata.role in Supabase
 * Usage: deno run --allow-env --allow-net --allow-read --env-file=.env update_user_role.ts 51c51584-e89c-4e70-9b22-8c4e5efc60a8 admin
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function usageAndExit() {
  console.log("Usage: deno run --allow-env --allow-net update_user_role.ts <user_id> <new_role>");
  Deno.exit(1);
}

if (Deno.args.length !== 2) {
  usageAndExit();
}

const [userId, newRole] = Deno.args;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log("SUPABASE_URL", SUPABASE_URL);
console.log("SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function updateUserRole(userId: string, role: string) {
  console.log("userId", userId);
  console.log("role", role);
  // Patch user's app_metadata
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (error) {
    console.error("Error updating user:", error.message);
    Deno.exit(1);
  }
  console.log(`Successfully updated user ${userId} role to '${role}'.`);
}

updateUserRole(userId, newRole);
