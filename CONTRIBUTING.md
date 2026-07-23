# Contributing to RookReader

First off, thank you for considering contributing to RookReader! It's people like you that make RookReader such a great tool.

## Code of Conduct

This project adheres to a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold it. Please be respectful and welcoming to all contributors.

## How Can I Contribute?

### Reporting Bugs & Requesting Features

* Please use the provided **Issue Forms** (`Bug Report` or `Feature Request`) to submit your feedback.
* Check existing issues to avoid duplicates before creating a new one.

### Pull Requests

We follow the [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) branching model. The `develop` branch is the integration branch for the next release; `main` always reflects the latest released version.

1. Fork the repository and create your branch **from `develop`** (not `main`).
   Use a descriptive branch name, e.g. `feature/<short-description>` or `bugfix/<short-description>`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs or features, update the documentation.
4. Run all the checks in [Before Submitting a Pull Request](#before-submitting-a-pull-request) and make sure they pass.
5. Open your Pull Request **against the `develop` branch** and fill in the provided Pull Request template.

## Development Setup

RookReader is built with **Tauri**, using **React**, **TypeScript**, and **Rust**.

### Prerequisites

* [Node.js](https://nodejs.org/) (v22 or higher recommended)
* [Rust](https://www.rust-lang.org/tools/install/) (installed via `rustup`)
* [Tauri Prerequisites](https://tauri.app/start/prerequisites/) (OS-specific dependencies for Windows, macOS, and Linux)
* [`cargo-about`](https://github.com/EmbarkStudios/cargo-about) — required to generate third-party license files, which run automatically during `dev` and `build`:
  ```bash
  cargo install cargo-about --locked --features cli
  ```

*Note: We also support development using **Dev Containers**. If your editor (like VS Code) supports it, you can open the project in a container for a ready-to-use environment that includes all of the above.*

### Building and Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/Rookro/RookReader.git
   cd RookReader
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run tauri dev
   ```

## Coding Guidelines

To maintain consistency across the codebase, please follow these rules:

* **Comments:** Write all code comments in English.
* **Frontend (React/TypeScript):**
  * Follow the existing project structure (e.g., separating Redux slices, MUI components, etc.).
  * Run `npm run check` before committing (Biome lint + format). Use `npm run check:fix` to apply fixes automatically.
* **Backend (Rust):**
  * Format your code with `cargo fmt --all` (run from `src-tauri/`).
  * Ensure `cargo clippy --all-targets --all-features -- -D warnings` is clean.
* **Generated bindings:** If you change Rust types exposed to the frontend, regenerate the TypeScript bindings with `npm run gen:bindings` and commit the updated `src/bindings/*` files.
* **Domain Logic:** If you are modifying the reader core (e.g., EPUB parsing), please test the right-to-left (RTL) page-turning logic for vertically written comics/novels, as this is a core feature of RookReader.

### Commit Messages

We loosely follow the [Conventional Commits](https://www.conventionalcommits.org/) style (e.g. `feat:`, `fix:`, `test:`, `ci:`, `docs:`). This keeps the history readable and helps with changelog generation.

## Before Submitting a Pull Request

Run the same checks that CI enforces, so your PR passes on the first try:

| Check                    | Command                                                       |
| ------------------------ | ------------------------------------------------------------- |
| Frontend lint & format   | `npm run check` (auto-fix: `npm run check:fix`)               |
| Rust format              | `cargo fmt --all` (from `src-tauri/`)                         |
| Rust lint                | `cargo clippy --all-targets --all-features -- -D warnings`    |
| Generated TS bindings    | `npm run gen:bindings:check`                                  |
| Tests (frontend + Rust)  | `npm run test`                                                |
| End-to-end tests         | `npm run test:e2e`                                            |

> **Tip:** `npm run gen:bindings:check` fails if the committed TypeScript bindings are out of date. If it fails, run `npm run gen:bindings` and commit the changes.

## Troubleshooting

* **`cargo-about` not found / license generation fails:** Make sure `cargo-about` is installed (see [Prerequisites](#prerequisites)). It runs automatically as part of `dev` and `build`.
* **Linux system dependencies:** On Debian/Ubuntu you may need:
  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```
  (add `xvfb` if you want to run E2E tests headlessly).
* **E2E tests:** They use an embedded WebDriver provider, so no external `tauri-driver`/`msedgedriver` setup is required. On Linux, run them under `xvfb-run` if you don't have a display.

## License

By contributing to RookReader, you agree that your contributions will be licensed under the [MIT License](./LICENSE) that covers the project.

Thank you for contributing!
