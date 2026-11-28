# Documentation Screenshot Capture

Generates the 4 documentation screenshots (`1280×800`, dark theme) used in `README.md`, `docs/ja_JP/README.md`, and `docs/wiki/Home.md`:

- `docs/images/reader_screenshot.png` (English)
- `docs/images/bookshelf_screenshot.png` (English)
- `docs/images/ja_JP/reader_screenshot.png` (Japanese)
- `docs/images/ja_JP/bookshelf_screenshot.png` (Japanese)

## Usage

From the repository root (Linux host or DevContainer):

```bash
npm run screenshots
```

This builds the E2E-enabled release binary (`--features e2e-test`, `VITE_E2E=true`), packs temporary `.cbz` sample books in `os.tmpdir()` from `assets/`, runs WebdriverIO with isolated `XDG_*` and `ROOKREADER_DATA_DIR` directories so your real library is untouched, saves the 4 PNGs, and deletes all temporary files.

If `src-tauri/target/release/rook-reader` is already built with `--features e2e-test` and `VITE_E2E=true`, pass `--skip-build` to re-capture quickly:

```bash
npm run screenshots -- --skip-build
```

On headless Linux environments (without `DISPLAY` or `WAYLAND_DISPLAY`), `capture.mjs` automatically wraps `wdio` with `xvfb-run --auto-servernum` when available.

## Sample Assets Provenance

All images under `assets/en/` and `assets/ja/` are original, fictional dummy manga pages and book covers created solely for RookReader's documentation screenshots. The base illustrations were AI-generated with generic prompts (no third-party characters, titles, or logos) and overlaid with original titles and dialogue.
