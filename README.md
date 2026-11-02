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
├── packages/og-image/
├── packages/shared-logic/
├── package.json
└── turbo.json
```
