import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export function localSupabaseStatus() {
  const output = execFileSync(
    "pnpm",
    ["exec", "supabase", "status", "--env", "--output-format", "text"],
    {
      cwd: new URL("../packages/database/", import.meta.url),
      encoding: "utf8",
      env: Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith("SUPABASE_")),
      ),
    },
  );
  return parseEnv(output);
}

export function localDatabaseUrl() {
  return loopbackUrl(localSupabaseStatus().DB_URL, "postgresql:").href;
}

function loopbackUrl(value, protocol) {
  const url = URL.parse(value ?? "");
  if (url?.protocol !== protocol || url.hostname !== "127.0.0.1" || !url.port || url.search) {
    throw new Error("Expected a loopback endpoint from local Supabase status.");
  }
  return url;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  switch (process.argv[2]) {
    case "db-url":
      console.log(localDatabaseUrl());
      break;
    case "db-port":
      console.log(new URL(localDatabaseUrl()).port);
      break;
    case "website": {
      const { API_URL, PUBLISHABLE_KEY, SECRET_KEY } = localSupabaseStatus();
      const url = loopbackUrl(API_URL, "http:");
      if (!PUBLISHABLE_KEY || !SECRET_KEY) {
        throw new Error("Local Supabase status did not supply both application keys.");
      }

      const env = {
        ...process.env,
        SUPABASE_URL: url.origin,
        SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
        SUPABASE_SECRET_KEY: SECRET_KEY,
        NUXT_SUPABASE_URL: url.origin,
        NUXT_SUPABASE_SECRET_KEY: SECRET_KEY,
        NUXT_PUBLIC_SUPABASE_URL: url.origin,
        NUXT_PUBLIC_SUPABASE_KEY: PUBLISHABLE_KEY,
        // Cookies are shared across app ports on the same hostname.
        NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX: `sb-local-${url.port}-auth-token`,
        NUXT_PUBLIC_DEV_SUPABASE_PROXY: "true",
      };
      const website = spawn("pnpm", ["dev", "--host", "0.0.0.0", ...process.argv.slice(3)], {
        cwd: new URL("../apps/website/", import.meta.url),
        env,
        stdio: "inherit",
      });
      for (const signal of ["SIGINT", "SIGTERM"]) {
        process.on(signal, () => website.kill(signal));
      }
      website.on("exit", (code, signal) => {
        process.exitCode = code ?? (signal === "SIGINT" ? 130 : 143);
      });
      break;
    }
    default:
      throw new Error("Expected db-url, db-port or website.");
  }
}
