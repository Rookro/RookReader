# RookReader Gemini AI Instructions

This document provides foundational mandates, project context, and workflows for Gemini AI when assisting with the **RookReader** project. These instructions take absolute precedence.

## 1. Project Context

- **Project Name:** RookReader
- **Description:** A modern, fast, cross-platform e-book reader (comic/novel viewer) supporting zip, rar, pdf, and epub formats. Specialized for Japanese vertical writing (right-to-left).
- **Tech Stack:**
  - **Frontend:** React (v19), TypeScript, Vite (v8), Material UI (MUI), Redux Toolkit.
  - **Backend:** Rust, Tauri (v2), SQLite (sqlx).
  - **Testing:** Vitest (Frontend unit tests), WebdriverIO (E2E).
  - **Validation:** Zod (schema and input validation).
- **Architecture:**
  - Frontend code resides in `src/`.
    - `src/features/`: Feature-scoped UI components.
    - `src/hooks/`: Custom React hooks.
    - `src/bindings/`: Tauri API wrappers and backend communication.
    - `src/store/`: Global state management with Redux Toolkit.
  - Components are primarily functional React components with hooks.
  - Backend code resides in `src-tauri/src/`.
    - `src-tauri/src/commands/`: Tauri commands exposed to the frontend.
    - `src-tauri/src/database/`: SQLite database operations via sqlx.
    - `src-tauri/src/container/`: File system access and parsing logic for zip, rar, pdf, and epub formats.
  - State management is handled by Redux Toolkit for complex global state, and React hooks for local state.
- **Coding Standards:**
  - **TypeScript:** Strict type checking (`npx tsc --noEmit`). Do not use the `any` type. Adhere to Biome rules (`npm run check`). Use functional components and hooks. **NEVER use `console.log` or other `console` methods for logging; use the Tauri logger plugin (`@tauri-apps/plugin-log`) instead.**
  - **Rust:** Adhere to `cargo clippy` and `cargo fmt` standards. Error handling should be explicit (using `Result` and `anyhow`/`thiserror` where appropriate). **NEVER use `.unwrap()` or `.expect()` in production code; always handle errors explicitly.** Asynchronous programming using `tokio` and `async-trait`. **NEVER use `println!` or similar macros for logging; use the `log` crate (Tauri logger) instead.**
  - **Documentation Comments:**
    - **Language:** All comments and documentation must be written in English.
    - **TypeScript:** Use TSDoc format (`/** ... */`) for exported functions, interfaces, types, and React component props.
    - **Rust:** Use standard Rustdoc (`///` or `//!`). For public functions, module definitions, and Tauri commands, explicitly document parameters and return types using `# Arguments`, `# Returns`, and `# Errors` sections.
  - **Tauri Commands:** Ensure Tauri commands (`#[tauri::command]`) are properly registered in `src-tauri/src/lib.rs` and have corresponding TypeScript bindings in `src/bindings/`. For frontend integrations requiring system access, **must strictly use official Tauri v2 plugins** (e.g., `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`) rather than legacy core APIs.

## 2. Workflows & Commands

- **Development Server:**
  - `npm run dev` (Runs Tauri app in dev mode, includes license generation).
- **Checking type:**
  - `npx tsc --noEmit`
- **Linting & Formatting:**
  - `npm run check` (biome check)
  - `npm run check:fix` (Automated linting and formatting fixes via biome)
  - `cargo clippy --manifest-path src-tauri/Cargo.toml` (Rust linting)
  - `cargo fmt --manifest-path src-tauri/Cargo.toml` (Rust formatting)
- **Testing:**
  - `npm run test` (Runs Frontend tests via Vitest and Rust tests via cargo).
  - `npm run test:frontend` (Runs only Frontend tests via Vitest).
  - `npm run test:frontend:coverage` (Runs frontend test coverage).
  - `npm run test:backend` (Runs only Rust tests via cargo).
  - `npm run test:e2e` (Runs WebdriverIO E2E tests).
  - `npm run test:e2e:win` (Runs WebdriverIO E2E tests on Windows).
- **Database Migrations (sqlx):**
  Run the following commands within the `src-tauri/` directory:
  - `sqlx migrate add -r <name>`: Creates a new migration file (`<timestamp>_<name>.up.sql` and `<timestamp>_<name>.down.sql`).
  - `cargo sqlx prepare`: Generates the `query-*.json` files required for OFFLINE builds. Ensure this is run after any schema or query changes.

## 3. Core Mandates for Gemini AI

1.  **Understand the Architecture:** When adding a new feature that touches both frontend and backend, ensure you:
    - Create or update the Rust core logic (e.g., in `src-tauri/src/database/` or `src-tauri/src/container/`).
    - Create or update the Tauri command in `src-tauri/src/commands/`.
    - Register the command in `src-tauri/src/lib.rs`.
    - Create or update the TypeScript binding in `src/bindings/`.
    - Integrate the binding into the React frontend (e.g., Redux thunk or custom hook).
2.  **State Management:** Prefer Redux Toolkit (`createAsyncThunk`, `createSlice`) for global application state (like reading history, bookshelf contents). Use local React state (`useState`, `useReducer`) for component-specific UI state.
3.  **Error Handling:** Surface backend errors clearly to the frontend. Use the custom `CommandError` structure defined in `src/types/Error.ts`.
4.  **Localization (i18n):** The project uses `react-i18next`. New user-facing strings should be added to the localization files in `src/i18n/locales/`.
5.  **Styling:** Use Material UI (MUI) components and the `sx` prop for styling. Ensure UI is responsive and follows the established theme (`src/hooks/useAppTheme.ts`).
6.  **Validation:** After making changes, always verify correctness using `cargo clippy` for Rust, and `npx tsc --noEmit` and `npm run check` for TypeScript.

## 4. Security & Safety

- Do not expose raw file system paths unnecessarily. Use Tauri's fs/path APIs where appropriate. Maintain strict capability scopes when using Tauri file system plugins to enforce secure boundaries.
- Prevent SQL injection by using parameterized queries with `sqlx::query!`.
- Ensure robust input validation between the frontend and backend boundaries using **Zod**.
- Never log sensitive user data or full file contents in production logs.

## 5. Behavioral Guidelines

These guidelines aim to reduce common LLM coding mistakes. They bias toward caution over speed. For trivial tasks, use judgment.

### 5.1 Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 5.2 Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 5.3 Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 5.4 Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
