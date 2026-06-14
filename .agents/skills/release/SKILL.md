---
name: release
description: Bump the RookReader app version across all version files, promote the CHANGELOG [Unreleased] section to a dated release, and create the two release commits. Invoke as `/release X.Y.Z` (e.g. `/release 1.2.3`).
---

# Release

Automates a RookReader version release. Given a target version, this skill updates every version-bearing file, promotes the `## [Unreleased]` CHANGELOG section into a dated release entry (English and Japanese changelogs), and creates two commits that mirror the established release pattern.

This skill **only edits files and commits** to the current branch. It does **not** create a branch, push, or open a pull request.

## Usage

```
/release X.Y.Z
```

`X.Y.Z` is the new semantic version (e.g. `1.2.3`). It is required.

## Inputs and validation

1. Read the target version from the argument.
   - It must match `^\d+\.\d+\.\d+$`. If missing or malformed, stop and report the expected format.
2. Read the **previous version** from the `version` field in `package.json`. This is the source of truth used for the CHANGELOG compare links.
   - If the target version equals the previous version, stop and report it.
3. Confirm the CHANGELOG has something to release: the `## [Unreleased]` section in `CHANGELOG.md` must contain at least one entry (a non-empty `### Added/Changed/Fixed` list).  
   If it is empty, stop and report that there is nothing to release.

Let `OLD` = previous version, `NEW` = target version, `DATE` = today's date in `YYYY-MM-DD` format (use the actual execution date).

## Step 1 — Bump version strings

Replace the version in each file. Each is a single, unambiguous occurrence.

| File | Field |
|---|---|
| `package.json` | `"version": "OLD"` → `"version": "NEW"` |
| `src-tauri/tauri.conf.json` | `"version": "OLD"` → `"version": "NEW"` |
| `src-tauri/Cargo.toml` | under `[package]`: `version = "OLD"` → `version = "NEW"` |
| `PKGBUILD/PKGBUILD` | `pkgver=OLD` → `pkgver=NEW` |

## Step 2 — Sync lock files via commands

Do **not** hand-edit the lock files. Run the commands so the lock files stay consistent, while producing only the version diff.

- `package-lock.json`: after `package.json` is bumped, run **only**:

  ```
  npm install --package-lock-only
  ```

  This rewrites just the lock file (no `node_modules` install, no `npm ci`). The diff should be exactly two lines: the top-level `version` and `packages[""].version`.

- `src-tauri/Cargo.lock`: after `Cargo.toml` is bumped, run:

  ```
  cargo update --package rook-reader --manifest-path src-tauri/Cargo.toml
  ```

  This syncs only the `rook-reader` package entry (a single-line diff) and leaves all other dependencies untouched.

After both commands, run `git diff package-lock.json` and `git diff src-tauri/Cargo.lock` and confirm only version-related lines changed.
If anything else changed, stop and report it before committing.

## Step 3 — Promote the CHANGELOG (both files)

Apply the same transformation to **`CHANGELOG.md`** and **`docs/ja_JP/CHANGELOG.md`**.

1. Insert a new release header immediately after the `## [Unreleased]` heading, leaving `## [Unreleased]` empty.  
   The previously-unreleased entries now belong under the new version:

   ```
   ## [Unreleased]

   ## [NEW] - DATE

   ### Added
   ...the entries that were under Unreleased...
   ```

2. Update the link references at the bottom of the file:
   - Change the unreleased compare link to start from the new tag:

     ```
     [unreleased]: https://github.com/Rookro/RookReader/compare/vNEW...HEAD
     ```

   - Add a new line directly below `[unreleased]` (above the existing latest version line):

     ```
     [NEW]: https://github.com/Rookro/RookReader/compare/vOLD...vNEW
     ```

Do not translate or alter any changelog entry text — only restructure headings and links.
The Japanese file uses the same link URLs as the English file.

## Step 4 — Commit (two commits, current branch)

Create two commits that match the release convention. Do not push or open a PR.

1. `build: update version to NEW`
   - Stage: `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`,
     `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `PKGBUILD/PKGBUILD`
2. `docs: update changelogs for vNEW`
   - Stage: `CHANGELOG.md`, `docs/ja_JP/CHANGELOG.md`

## Step 5 — Verify

- Confirm `NEW` appears in all version files: `package.json`, `tauri.conf.json`, `Cargo.toml`, `PKGBUILD/PKGBUILD`, both lock files, and both changelogs.
- Confirm the lock-file diffs contain only version-related changes (Step 2).
- Recommended (optional, slow): `cargo check --manifest-path src-tauri/Cargo.toml` passes.
- Confirm the two commits have the expected file sets: `git show --stat HEAD` and `git show --stat HEAD~1`.
