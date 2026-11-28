import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const lang = process.env.CAPTURE_LANG || "en";
const tmpRoot = process.env.CAPTURE_TMP_DIR;
if (!tmpRoot) {
  throw new Error("CAPTURE_TMP_DIR must be set (run via `npm run screenshots`).");
}

const repoRoot = process.cwd();
const isWindows = os.platform() === "win32";
const binaryExt = isWindows ? ".exe" : "";
const appBinary = path.join(repoRoot, "src-tauri", "target", "release", `rook-reader${binaryExt}`);

const xdgBase = path.join(tmpRoot, `xdg-${lang}`);
const xdgData = path.join(xdgBase, "data");
const xdgConfig = path.join(xdgBase, "config");
const xdgCache = path.join(xdgBase, "cache");
const dataDir = path.join(xdgData, "io.github.rookro.rookreader");
const libDir = path.join(tmpRoot, lang);

// Guard setup on WDIO_WORKER_ID: workers re-import this config while the spawned app is running.
if (!process.env.WDIO_WORKER_ID) {
  rmSync(xdgBase, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(xdgConfig, { recursive: true });
  mkdirSync(xdgCache, { recursive: true });
  mkdirSync(path.join(repoRoot, "docs", "images", "ja_JP"), { recursive: true });

  writeFileSync(
    path.join(dataDir, "window-size.json"),
    JSON.stringify({ main: { width: 1280, height: 800 } }, null, 2),
  );

  writeFileSync(
    path.join(dataDir, "rook-reader_settings.json"),
    JSON.stringify(
      {
        general: { theme: "dark" },
        startup: {
          initialView: "reader",
          restoreLastBook: false,
          checkUpdateOnStartup: false,
        },
        fileNavigator: {
          homeDirectory: libDir,
          watchDirectory: false,
        },
        reader: {
          comic: {
            enableSpread: true,
            showCoverAsSinglePage: true,
          },
        },
      },
      null,
      2,
    ),
  );
}

export const config = {
  runner: "local",
  specs: [path.join(repoRoot, "scripts", "screenshots", "spec.mjs")],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "tauri",
      "wdio:enforceWebDriverClassic": true,
      "tauri:options": {
        application: appBinary,
      },
      "wdio:tauriServiceOptions": {
        appBinaryPath: appBinary,
        env: {
          XDG_DATA_HOME: xdgData,
          XDG_CONFIG_HOME: xdgConfig,
          XDG_CACHE_HOME: xdgCache,
          ROOKREADER_DATA_DIR: dataDir,
        },
      },
    },
  ],
  services: [
    [
      "@wdio/tauri-service",
      {
        driverProvider: "embedded",
        appBinaryPath: appBinary,
        startTimeout: 60000,
        statusPollTimeout: 8000,
      },
    ],
  ],
  reporters: ["spec"],
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },
};
