# DubbingBase

DubbingBase is a comprehensive platform dedicated to tracking and managing dubbing information for movies and TV shows. It serves as a database for voice actors, their roles, and the productions they are involved in.

## 🏗 Architecture

This project is a **Monorepo** managed by [Turbo Repo](https://turbo.build/) and [pnpm](https://pnpm.io/). It consists of the following main applications:

*   **Mobile App (`apps/mobile`)**: A cross-platform mobile application built with Ionic and Capacitor, allowing users to browse the database, view actor profiles, and manage their own lists.
*   **Website (`apps/website`)**: A web interface for the platform, featuring data grids and analytics.
*   **Supabase Backend (`packages/supabase`)**: The backend infrastructure including database schemas, edge functions, and migrations.

## 🚀 Getting Started

### Prerequisites
*   Node.js (Latest LTS recommended)
*   pnpm (`npm install -g pnpm`)

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

To run the development servers for all apps simultaneously:

```bash
pnpm dev
```

Or run specific apps:

*   **Mobile**: `cd apps/mobile && pnpm dev`
*   **Website**: `cd apps/website && pnpm dev`

### Building

To build all applications:

```bash
pnpm build
```

## 📂 Project Structure

```
├── apps/
│   ├── mobile/       # Ionic/Capacitor mobile application
│   └── website/      # Vue/Tailwind web application
├── packages/
│   └── supabase/     # Supabase configurations and functions
├── package.json      # Root configuration
└── turbo.json        # Turbo Repo configuration
```
