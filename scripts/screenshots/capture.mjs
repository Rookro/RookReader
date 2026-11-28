import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { configure, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js";

const scriptsDir = import.meta.dirname;
const repoRoot = path.resolve(scriptsDir, "..", "..");
const assetsRoot = path.join(scriptsDir, "assets");
const skipBuild = process.argv.includes("--skip-build");
const appBinary = path.join(repoRoot, "src-tauri", "target", "release", "rook-reader");

/** Book manifests used to assemble temporary CBZ archives for each locale. */
const LIBRARY_SPECS = {
  en: [
    { filename: "Clockwork Harbor Vol. 1.cbz", cover: "clockwork-harbor-v1.webp", pages: 10 },
    { filename: "Clockwork Harbor Vol. 2.cbz", cover: "clockwork-harbor-v2.webp", pages: 8 },
    { filename: "Clockwork Harbor Vol. 3.cbz", cover: "clockwork-harbor-v3.webp", pages: 8 },
    { filename: "Starlight Express.cbz", cover: "starlight-express.webp", pages: 10 },
    { filename: "Forest of Lanterns.cbz", cover: "forest-of-lanterns.webp", pages: 8 },
    { filename: "Glass Observatory.cbz", cover: "glass-observatory.webp", pages: 8 },
  ],
  ja: [
    { filename: "時計仕掛けの港 第1巻.cbz", cover: "clockwork-harbor-v1.webp", pages: 10 },
    { filename: "時計仕掛けの港 第2巻.cbz", cover: "clockwork-harbor-v2.webp", pages: 8 },
    { filename: "時計仕掛けの港 第3巻.cbz", cover: "clockwork-harbor-v3.webp", pages: 8 },
    { filename: "星屑急行.cbz", cover: "starlight-express.webp", pages: 10 },
    { filename: "ランタンの森.cbz", cover: "forest-of-lanterns.webp", pages: 8 },
    { filename: "硝子の天文台.cbz", cover: "glass-observatory.webp", pages: 8 },
  ],
};

/**
 * Packs a cover image and alternating manga spread pages into an uncompressed `.cbz` archive.
 *
 * @param {string} outPath - Destination `.cbz` path.
 * @param {Uint8Array} coverBytes - Cover image bytes (`001.webp`).
 * @param {Uint8Array} page2Bytes - Odd-index page bytes (right page in RTL spread).
 * @param {Uint8Array} page3Bytes - Even-index page bytes (left page in RTL spread).
 * @param {number} totalPages - Total page count including the cover.
 */
async function writeCbz(outPath, coverBytes, page2Bytes, page3Bytes, totalPages) {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await writer.add("001.webp", new Uint8ArrayReader(coverBytes), { level: 0 });
  for (let i = 2; i <= totalPages; i++) {
    const entryName = `${String(i).padStart(3, "0")}.webp`;
    const bytes = i % 2 === 0 ? page2Bytes : page3Bytes;
    await writer.add(entryName, new Uint8ArrayReader(bytes), { level: 0 });
  }
  writeFileSync(outPath, await writer.close());
}

/**
 * Generates temporary EN and JA CBZ libraries from the checked-in WebP assets.
 *
 * @param {string} tmpRoot - Temporary root directory.
 */
async function buildTempLibraries(tmpRoot) {
  configure({ useWebWorkers: false });
  for (const [lang, books] of Object.entries(LIBRARY_SPECS)) {
    const langAssetsDir = path.join(assetsRoot, lang);
    const outDir = path.join(tmpRoot, lang);
    mkdirSync(outDir, { recursive: true });

    const page2 = new Uint8Array(readFileSync(path.join(langAssetsDir, "manga-page-2.webp")));
    const page3 = new Uint8Array(readFileSync(path.join(langAssetsDir, "manga-page-3.webp")));
    for (const book of books) {
      const cover = new Uint8Array(readFileSync(path.join(langAssetsDir, book.cover)));
      await writeCbz(path.join(outDir, book.filename), cover, page2, page3, book.pages);
    }
  }
}

/**
 * Runs a command synchronously and throws if it fails so `finally` cleanup still runs.
 *
 * @param {string} command - Executable name.
 * @param {string[]} args - Command arguments.
 * @param {NodeJS.ProcessEnv} env - Environment variables.
 */
function runOrThrow(command, args, env) {
  const res = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env,
  });
  if (res.error) {
    throw new Error(`Failed to spawn ${command}: ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${res.status ?? 1}`);
  }
}

/** Returns whether a live Wayland socket or X11 display is available. */
function hasLiveDisplay() {
  if (process.env.DISPLAY) return true;
  if (process.env.WAYLAND_DISPLAY) {
    const runtimeDir = process.env.XDG_RUNTIME_DIR || "/tmp";
    const socketPath = path.isAbsolute(process.env.WAYLAND_DISPLAY)
      ? process.env.WAYLAND_DISPLAY
      : path.join(runtimeDir, process.env.WAYLAND_DISPLAY);
    return existsSync(socketPath);
  }
  return false;
}

/** Returns whether `xvfb-run` is available for headless Linux capture. */
function hasXvfb() {
  const res = spawnSync("xvfb-run", ["--help"], { stdio: "ignore" });
  return !res.error && res.status === 0;
}

async function main() {
  if (os.platform() !== "linux") {
    throw new Error(
      "Screenshot capture is only supported on Linux (host or DevContainer) due to XDG/window-size isolation.",
    );
  }

  const liveDisplay = hasLiveDisplay();
  const useXvfb = !liveDisplay;
  if (useXvfb && !hasXvfb()) {
    throw new Error(
      "No active DISPLAY or Wayland socket found, and `xvfb-run` is not installed. Run inside a desktop session or install xvfb.",
    );
  }

  if (!skipBuild) {
    const e2eConfig = path.join(repoRoot, "src-tauri", "tauri.conf.e2e.json");
    runOrThrow(
      "npm",
      [
        "run",
        "tauri",
        "build",
        "--",
        "--no-bundle",
        "--features",
        "e2e-test",
        "--config",
        e2eConfig,
      ],
      { ...process.env, VITE_E2E: "true", SQLX_OFFLINE: "true" },
    );
  } else if (!existsSync(appBinary)) {
    throw new Error(`--skip-build was set, but ${appBinary} does not exist.`);
  }

  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "rookreader-screenshots-"));
  try {
    await buildTempLibraries(tmpRoot);

    const wdioConfig = path.join(scriptsDir, "wdio.conf.mjs");
    for (const lang of ["en", "ja"]) {
      const env = {
        ...process.env,
        CAPTURE_LANG: lang,
        CAPTURE_TMP_DIR: tmpRoot,
      };
      if (useXvfb) {
        // Clear inactive WAYLAND_DISPLAY (e.g. DevContainer containerEnv) so GTK uses Xvfb's DISPLAY.
        delete env.WAYLAND_DISPLAY;
        runOrThrow("xvfb-run", ["--auto-servernum", "--", "npx", "wdio", "run", wdioConfig], env);
      } else {
        runOrThrow("npx", ["wdio", "run", wdioConfig], env);
      }
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`[Error] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
