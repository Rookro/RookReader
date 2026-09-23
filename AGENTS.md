# RookReader Agent Guide

RookReader is a cross-platform e-book reader for comics and novels (zip/cbz, rar/cbr, pdf, epub), built around Japanese right-to-left, vertical-writing reading.

- **Frontend** (`src/`): React 19, TypeScript, Vite 8, MUI, Redux Toolkit; Vitest for unit tests, WebdriverIO for E2E.
- **Backend** (`src-tauri/src/`): Rust, Tauri v2, SQLite via sqlx, tokio.

The directory layout is documented in `docs/wiki/Developer-Guide.md`; check it (or the tree) rather than assuming where code lives.

## Commands

| Purpose | Command |
| --- | --- |
| Run the app | `npm run tauri dev` (`npm run dev` starts only the Vite frontend) |
| Type check | `npx tsc --noEmit` |
| Lint + format TS | `npm run check` (`npm run check:fix` to apply fixes) |
| Lint Rust | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` |
| Format Rust | `cargo fmt --manifest-path src-tauri/Cargo.toml` |
| Tests | `npm run test` (frontend + backend), `npm run test:frontend`, `npm run test:frontend:coverage`, `npm run test:backend`, `npm run test:e2e` |
| Regenerate bindings | `npm run gen:bindings` (`npm run gen:bindings:check` fails on drift) |
| Check wiki | `npm run check:wiki` |
| Database (in `src-tauri/`) | `cargo sqlx database setup` once; `cargo sqlx migrate add -r <name>` for a new migration, then `cargo sqlx migrate run`; `cargo sqlx prepare` after any schema or query change |

Before reporting a change as done, run what CI runs for the parts you touched: clippy (with `-D warnings`), `cargo fmt`, and `test:backend` for Rust; `tsc`, `check`, and `test:frontend` for TypeScript; `gen:bindings` when commands, their types, or error codes changed, keeping the regenerated files in the change (CI's `gen:bindings:check` fails on drift); `check:wiki` when a wiki page changed.

Locally, the `sqlx` macros check queries against `src-tauri/rook-reader.db` (`DATABASE_URL` in `src-tauri/.env`), so apply new migrations (your own or pulled ones) with `migrate run` before building. CI builds with `SQLX_OFFLINE=true` from the `.sqlx/` cache instead, so a query or schema change without `cargo sqlx prepare` and the updated `.sqlx/` in the change compiles locally but fails in CI.

## Conventions

**TypeScript**
- No `any`.
- Log with `@tauri-apps/plugin-log`, not `console.*`, so messages reach the app's log file.
- Global state (reading history, bookshelf, …) lives in Redux Toolkit slices and `createAsyncThunk`; component-only UI state uses `useState` / `useReducer`.
- Style with MUI components and the `sx` prop, following the theme in `src/hooks/useAppTheme.ts`.
- User-facing strings go through `react-i18next`; add every new key to both `src/i18n/locales/en-US.json` and `ja-JP.json`.
- Frontend system access uses official Tauri v2 plugins (`@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`, …), not the legacy core APIs.
- TSDoc (`/** … */`) on exported functions, interfaces, types, and component props.

**Rust**
- No `.unwrap()` / `.expect()` outside tests; return a `Result` (errors via `thiserror`) so failures reach the frontend as a `CommandError` instead of a panic.
- Log with the `log` crate macros, not `println!` / `eprintln!`.
- SQL uses the `sqlx::query!` / `query_as!` macros: parameterized and checked at compile time.
- Async code runs on tokio; repository traits use `async-trait`.
- Rustdoc (`///`, `//!`); public functions, modules, and Tauri commands document `# Arguments`, `# Returns`, and `# Errors`.

**Tests**
- Frontend tests sit next to the code as `*.test.ts(x)`; render with `renderWithProviders` from `src/test/utils.tsx` and build data with `src/test/factories.ts`.
- `src/test/mocks/bindings.ts` mocks every `src/bindings/*Commands.ts` module for all tests; when you add a wrapper function, add it there too, or tests that reach it fail.
- Rust unit tests go in a `#[cfg(test)]` module in the same file; repository tests in `src-tauri/tests/` use `common::setup_db()` (in-memory SQLite with the migrations applied).

Write all code comments and documentation in English.

## Tauri commands and bindings

`src/bindings/bindings.ts` and `src/bindings/errorCodes.ts` are generated from Rust by `tauri-specta`; do not edit them by hand. To add or change a command:

1. Put the logic in Rust (`src-tauri/src/domain/`, `infrastructure/database/`, `container/`, …).
2. Expose it from `src-tauri/src/commands/` with `#[tauri::command]` + `#[specta::specta]`.
3. Register it in `specta_builder()`'s `collect_commands!` in `src-tauri/src/lib.rs`. Commands returning a raw `tauri::ipc::Response` (binary payloads) go in the separate `generate_handler!` there instead and keep a raw `invoke` on the frontend.
4. Run `npm run gen:bindings`.
5. Add or update the thin wrapper in `src/bindings/*Commands.ts` that delegates to the generated `commands.*`, casting to the narrower `src/domain/*` types with `as` where needed.
6. Call the wrapper from a Redux thunk or a hook.

**Error codes** are defined only in Rust (`ErrorCode::code()` in `src-tauri/src/error.rs`). To add one, add the variant and its `code()` arm, then regenerate. The frontend uses `CommandError` from `src/types/Error.ts`, which re-exports the generated codes plus a frontend-only `unknown`.

**Validation:** application settings are validated in Rust (serde for shape and enums, `garde` for bounds) and their TypeScript types are generated. Other frontend input, such as domain entities, is validated with Zod.

**Settings:** the model, defaults, and bounds live in `src-tauri/src/settings/`. The frontend keeps copies in `src/features/Settings/defaultSettings.json` and `settingsBounds.json`, and Rust tests (`test_defaults_agree_with_frontend_json`, `test_bounds_agree_with_frontend_json`) fail when they drift. Adding or changing a setting therefore also means updating both JSON files, the i18n keys, and the settings reference in `docs/wiki/User-Guide.md` (`check:wiki` checks its names and defaults against the code), and regenerating the bindings.

## Security

- Don't expose raw file system paths unnecessarily; use Tauri's fs/path APIs where appropriate, and keep file system plugin capability scopes as narrow as the feature needs.
- Validate input at the frontend/backend boundary (see Validation above).
- Never log sensitive user data or full file contents.

## Documentation

The GitHub Wiki is synced from `docs/wiki/` on every push to `main`. When a change affects what a page describes, update the page in the same PR:

- `User-Guide.md`: user-visible behaviour (formats, File Navigator / toolbar / side-pane controls, keyboard and mouse, page display (direction, spread, loupe), continuous reading, bookmarks, bookshelf / collections / tags / series, reading history, EPUB) and every settings tab and item. Names come from `src/i18n/locales/en-US.json`, defaults from `src/features/Settings/defaultSettings.json`, bounds from `src/features/Settings/settingsBounds.json`.
- `FAQ-&-Troubleshooting.md`: data and log locations (`src-tauri/src/setup.rs`), logging, Linux packaging, window state.
- `Developer-Guide.md`: directory layout (`src/`, `src-tauri/src/`), the command/bindings workflow, error codes, npm scripts (`package.json`), CI (`.github/workflows/`), prerequisites and branching (`CONTRIBUTING.md`), database schema (`docs/database/er_diagram.md`).
- `Home.md`: the feature summary and supported formats.

A `CHANGELOG.md` entry under **Added** or **Changed** usually means a wiki page needs updating too. Validate any Mermaid diagram you change.

The changelog and README are bilingual: update `docs/ja_JP/CHANGELOG.md` and `docs/ja_JP/README.md` together with their English originals. Changelog entries follow Keep a Changelog, describe the outcome for the user rather than the implementation, and end with ` (#<PR number>)`.

## Git

The repo uses Git Flow: branch from `develop` as `feature/<short-description>` or `bugfix/<short-description>`, and open PRs against `develop`. `main` holds released versions only.

Commit messages follow Conventional Commits: `type(scope): summary`, e.g. `fix(reader): …`, `feat(commands): …`, `docs: …`. PR titles are plain sentences without a type prefix, e.g. `Split the history-changed event into one event per library list`; the merge commit uses the title and appends ` (#<PR number>)`.

## Working style

These guard against common agent mistakes; use judgment on trivial tasks.

- **Scope:** Keep the diff to what the task needs; every changed line should trace to the request. Don't refactor, reformat, or re-comment adjacent code. Mention unrelated problems (including dead code) instead of fixing them, and remove only what your own change made unused.
- **Simplicity:** Write the minimum code that solves the problem: no speculative features, options, or single-use abstractions, and no error handling for states that cannot occur. If a simpler approach than the one requested exists, say so. Match the surrounding code's style.
- **Ambiguity:** Don't assume. If anything is unclear, stop, name what is unclear, and ask before implementing; a direction picked on your own is what later forces a redo. When a request has several reasonable readings, present them with their tradeoffs instead of picking one silently, and state any assumptions you do make explicitly.
- **Verification:** Turn the task into a checkable goal before starting: for a bug fix, a test that fails without the fix; for a refactor, tests that pass before and after. For multi-step work, give a short plan with a check for each step, and keep going until the checks pass.
