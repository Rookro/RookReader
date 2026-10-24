---
name: release
description: Use when the user runs `/release X.Y.Z` (e.g. `/release 1.2.3`) to cut a RookReader release on a `release/vX.Y.Z` branch.
disable-model-invocation: true
---

# Release

Bumps every version-bearing file to the new version, promotes the `## [Unreleased]` section of both changelogs to a dated release, and creates the two release commits on the `release/vNEW` branch. Never commit to `develop` directly. Pushing, tagging, and opening a PR are the user's job, so leave them out.

## Preconditions

Define `OLD` as the `version` in `package.json`, `NEW` as the argument, and `DATE` as today's date (`YYYY-MM-DD`). Stop and report instead of editing anything when:

- `NEW` is missing or does not match `^\d+\.\d+\.\d+$`.
- `NEW` equals `OLD`.
- `## [Unreleased]` in `CHANGELOG.md` contains no list entries (nothing to release).
- Anything is already staged, or any file listed in the two commits below has uncommitted changes, since those would be swept into the release commits.
- The current branch, read with `git branch --show-current` (not the git status shown at session start, which may be stale), is neither `develop` nor `release/vNEW`.
- The current branch is `develop` and `release/vNEW` already exists.

## 1. Switch to the release branch

If the current branch is `develop`, create the release branch from it with `git switch -c release/vNEW`. If it is already `release/vNEW`, stay on it.

## 2. Bump the version files

Change only these lines. `OLD` can also appear elsewhere, such as in a dependency range in `package.json`, so never replace it file-wide:

| File | Line |
|---|---|
| `package.json` | `"version": "NEW"` |
| `src-tauri/tauri.conf.json` | `"version": "NEW"` |
| `src-tauri/Cargo.toml` | `version = "NEW"` under `[package]` |
| `PKGBUILD/PKGBUILD` | `pkgver=NEW` |

Then regenerate the lock files with these commands rather than editing them, so they stay consistent:

```
npm install --package-lock-only
cargo update --package rook-reader --manifest-path src-tauri/Cargo.toml
```

Check the result with `git diff package-lock.json src-tauri/Cargo.lock`. Expect exactly three changed lines: the top-level `version` and `packages[""].version` in `package-lock.json`, and the `rook-reader` entry's `version` in `Cargo.lock`. If anything else changed (for example, a dependency was re-resolved), stop and show the user the diff before committing.

## 3. Promote the changelogs

Apply the same edit to `CHANGELOG.md` and `docs/ja_JP/CHANGELOG.md`. Only headings and links change; the entry text stays exactly as written.

Insert the release heading directly under `## [Unreleased]`, so the existing entries move under it and `[Unreleased]` is left empty:

```
## [Unreleased]

## [NEW] - DATE

### Added
...
```

At the bottom of the file, point `[unreleased]` at the new tag and add the `[NEW]` link directly below it. Both files use the same URLs:

```
[unreleased]: https://github.com/Rookro/RookReader/compare/vNEW...HEAD
[NEW]: https://github.com/Rookro/RookReader/compare/vOLD...vNEW
```

## 4. Commit

Confirm `git branch --show-current` prints `release/vNEW`, then stage each commit by explicit path:

1. `build: update version to NEW`: `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `PKGBUILD/PKGBUILD`
2. `docs: update changelogs for vNEW`: `CHANGELOG.md`, `docs/ja_JP/CHANGELOG.md`

Confirm with `git show --stat HEAD~1 HEAD` that the first commit touches those six files and the second commit touches the two changelogs.

## Report

Tell the user `OLD → NEW`, the branch name `release/vNEW`, the two commit hashes and subjects, and that the branch has not been pushed.
