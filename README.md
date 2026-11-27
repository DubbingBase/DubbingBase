# DubbingBase

DubbingBase is a platform for exploring and managing dubbing information for movies, television, games, and other media. The Nuxt website is the single supported application and can be installed as a Progressive Web App on Android and iOS.

## 🏗 Architecture

This project is a **pnpm workspace** orchestrated by [Turborepo](https://turbo.build/). It consists of:

- **Website and PWA (`apps/website`)**: The web application and installable mobile experience.
- **Supabase (`packages/database`)**: Database configuration, migrations, and generated types.
- **Shared packages (`packages/`)**: Locales, shared logic, and Open Graph image utilities.

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- pnpm (`npm install -g pnpm`)

### Installation

1.  Clone the repository:

    ```bash
    git clone <repository-url>
    cd DubbingBase
    ```

2.  Install dependencies:
    ```bash
    pnpm install
    ```

### Running the Project

Run the website locally with the repository's standard environment setup:

```bash
mise run website
```

Docker must be running. The workspace pins Supabase CLI 3.4.0. Database commands
target the current local stack by default. Use `--remote` for an intentional
hosted operation. Each Git worktree gets its own Supabase database, Storage,
and automatically assigned ports. Postgres starts immediately and the other services
start on first use. The website uses Doppler’s `dubbingbase/dev` configuration for
external API keys and gets its Supabase URL and keys directly from the worktree’s
running stack. No local Supabase environment file is needed.

- Run `mise run backend` for database-only development. From the repository root,
  use `db_url=$(node scripts/local-supabase.mjs db-url) && psql "$db_url"` to query this stack.
- Worktree setup and teardown hooks can call `mise run backend` and
  `mise run backend-stop`. Before removing a plain Git worktree or switching its
  branch, run `mise run backend-stop` yourself. Reuse the same branch and path
  to keep its data and ports.
- To discard a disposable stack, run `pnpm exec supabase stack destroy`
  from `packages/database` before removing the worktree. The CLI asks for confirmation.
- `mise run db-reset` replays the migrations without loading the optional local
  `packages/database/supabase/seed.sql`. To reset a disposable stack with that
  seed, run `pnpm exec supabase db reset` from `packages/database`.

#### Moving data from the previous local stack

The experimental stack uses separate storage. The previous stack’s Docker volumes
remain available. Use a checkout of the previous revision with CLI 2.117.0 to
inspect and stop that stack. Use plain `supabase stop` to retain its data.

If you need existing local records, keep the legacy stack and the new stack
available while transferring them. On matching migration revisions, export the
local records you need from the legacy database with `pg_dump --data-only` for the
relevant tables. Import into a disposable new stack first and verify the records
before reusing the process in your development stack. Download and re-upload any
needed Storage files through each stack’s Studio. Keep the legacy stack and the
backup until you have checked the transferred data and files. Store dumps outside
Git. Supabase documents the separate data directories and CLI behavior in its
[multiple local projects guide](https://supabase.com/docs/guides/local-development/running-multiple-local-projects).

### Installing the PWA

To install DubbingBase on a phone, open `https://dubbingbase.com` in a supported browser. On Android, use Chrome's **Install app** or **Add to Home screen** option. On iPhone or iPad, use Safari's **Share → Add to Home Screen**. The installed PWA uses the same account and server-saved data as the website.

Existing accounts, follows, media, and contributions remain in Supabase. Browser and native app storage are separate; unsynced device-only data and preferences are not migrated automatically.

### Building

To build the website:

```bash
mise run build-web
```

## 📂 Project Structure

```
├── apps/website/       # Nuxt website and installable PWA
├── packages/database/ # Supabase configuration and migrations
├── packages/locales/
├── packages/shared-logic/
├── package.json
└── turbo.json
```
