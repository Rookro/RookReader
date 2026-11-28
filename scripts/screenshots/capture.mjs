import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { configure, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js";

const repoRoot = process.cwd();
const assetsRoot = path.join(repoRoot, "scripts", "screenshots", "assets");
const skipBuild = process.argv.includes("--skip-build");
const isWindows = os.platform() === "win32";
const binaryExt = isWindows ? ".exe" : "";
const appBinary = path.join(repoRoot, "src-tauri", "target", "release", `rook-reader${binaryExt}`);

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
 * Runs a command synchronously and exits with an error if it fails.
 *
 * @param {string} command - Executable name.
 * @param {string[]} args - Command arguments.
 * @param {NodeJS.ProcessEnv} env - Environment variables.
 */
function runOrFail(command, args, env) {
  const res = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: isWindows,
    env,
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

/** Returns whether `xvfb-run` is available for headless Linux capture. */
function hasXvfb() {
  if (os.platform() !== "linux") return false;
  const res = spawnSync("which", ["xvfb-run"], { stdio: "ignore" });
  return res.status === 0;
}

async function main() {
  if (!skipBuild) {
    const e2eConfig = path.join(repoRoot, "src-tauri", "tauri.conf.e2e.json");
    runOrFail(
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
    console.error(`[Error] --skip-build was set, but ${appBinary} does not exist.`);
    process.exit(1);
  }

  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "rookreader-screenshots-"));
  try {
    await buildTempLibraries(tmpRoot);

    const needsXvfb =
      os.platform() === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && hasXvfb();
    const wdioConfig = path.join(repoRoot, "scripts", "screenshots", "wdio.conf.mjs");

    for (const lang of ["en", "ja"]) {
      const env = {
        ...process.env,
        CAPTURE_LANG: lang,
        CAPTURE_TMP_DIR: tmpRoot,
      };
      if (needsXvfb) {
        runOrFail("xvfb-run", ["--auto-servernum", "--", "npx", "wdio", "run", wdioConfig], env);
      } else {
        runOrFail("npx", ["wdio", "run", wdioConfig], env);
      }
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main();
