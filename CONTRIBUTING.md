# Contributing to HarnessHub

Thanks for your interest in contributing!

HarnessHub is a Cargo workspace containing two Rust crates and a React + Vite frontend in `src/`. The desktop app is packaged with [Tauri](https://tauri.app/).

## Prerequisites

- **Node.js** ≥ 18
- **Rust** 1.85+ (edition 2024) — install via [rustup](https://rustup.rs/)
- **Tauri CLI** (only for desktop development): `cargo install tauri-cli --version "^2.0.0"`
- **Xcode Command Line Tools** (macOS only): `xcode-select --install`

This project uses **npm**, not pnpm or yarn.

## Getting Started

```bash
git clone https://github.com/xinsd-code/HarnessHub.git
cd HarnessHub
npm install
```

### Desktop App Development (macOS only)

```bash
cargo tauri dev
```

Tauri automatically runs `npm run dev` as a before-dev command and launches the native window.

## Building Releases

### macOS desktop app

```bash
./build.sh
```

Produces `.dmg` bundles for Apple Silicon and Intel.

To open the desktop app built from the current worktree, run:

```bash
npm run desktop:open
```

You can also pass a custom `.app` path if needed:

```bash
npm run desktop:open -- /absolute/path/to/HarnessHub.app
```

## Project Layout

```
crates/
├── hk-core/         Shared core: scanning, models, DB, agent adapters
└── hk-desktop/      Tauri desktop app (wraps hk-core + frontend)

src/                 React frontend (hosted by the desktop app)
├── pages/           Route pages (Overview, Agents, Extensions, Marketplace, Audit, Settings)
├── components/      Shared UI components
├── stores/          Zustand stores
├── hooks/           Custom React hooks
└── lib/             Utils, API client, type definitions

public/              Static assets
```

## Tests

```bash
npm test                    # frontend tests (vitest)
cargo test --workspace      # Rust tests
```

## Pull Requests

- Create a feature branch from `main` (e.g. `fix/marketplace-loading` or `feat/new-agent`)
- Use Conventional Commits in commit messages — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- Ensure `npm test` and `cargo test --workspace` pass before opening a PR
- Write a clear PR description: what problem it solves and how
- For UI changes, include a screenshot or short video
- Small, focused PRs are easier to review than large ones — prefer splitting when possible
