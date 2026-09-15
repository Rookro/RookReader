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
* [vcpkg](https://github.com/microsoft/vcpkg) (Windows) — builds the static libdav1d that the `image` crate's `avif-native` feature links for AVIF pages. Clone it, bootstrap it (`bootstrap-vcpkg.bat`) and put it on your `PATH`. Then, once, in `src-tauri/`:
  ```powershell
  vcpkg install --triplet rookreader-static
  ```
  This builds `dav1d` from source into the git-ignored `src-tauri/vcpkg_installed/`, which the repo's `.cargo/config.toml` points the build at; no environment variables are needed. The dav1d version is the one your vcpkg checkout carries; `git pull` it to get a newer one. On Linux, use the Dev Container below: it contains vcpkg and runs this command when the container is created, so nothing is installed on the host.

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

## Documentation (Wiki)

The [project wiki](https://github.com/Rookro/RookReader/wiki) is generated from the Markdown pages in [`docs/wiki/`](docs/wiki/) and pushed to the GitHub Wiki automatically on every release (push to `main`). **Do not edit the wiki on GitHub directly** — your change would be overwritten by the next sync.

* If your change affects anything a page describes (user-visible behaviour, a setting, a keyboard/mouse control, a directory, an npm script, a CI check, the contribution workflow), update the page **in the same Pull Request**.
* Run `npm run check:wiki`. It fails when a page references a repository path or an npm script that does not exist, or when the settings reference in `docs/wiki/User-Guide.md` names a setting or a default value that differs from the code.
* If you edit a Mermaid diagram, make sure it still renders (e.g. paste it into the [Mermaid Live Editor](https://mermaid.live/)).

## Before Submitting a Pull Request

Run the same checks that CI enforces, so your PR passes on the first try:

| Check                    | Command                                                       |
| ------------------------ | ------------------------------------------------------------- |
| Frontend lint & format   | `npm run check` (auto-fix: `npm run check:fix`)               |
| Rust format              | `cargo fmt --all` (from `src-tauri/`)                         |
| Rust lint                | `cargo clippy --all-targets --all-features -- -D warnings`    |
| Generated TS bindings    | `npm run gen:bindings:check`                                  |
| Wiki pages               | `npm run check:wiki`                                          |
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
