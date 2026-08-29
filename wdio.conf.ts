import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Best-effort removal of a directory, tolerating Windows file locks and missing paths. */
function removeDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch {
    // ignore — a leftover temp dir is harmless and the OS reclaims it later
  }
}

const isWindows = os.platform() === "win32";
const binaryExt = isWindows ? ".exe" : "";

// A fresh, empty data directory per run isolates the app's config/DB/thumbnails from any
// pre-existing user data. The e2e-test build honours ROOKREADER_DATA_DIR. Created only in the
// launcher process (which spawns the shared app instance); spec workers re-load this config
// too, so guarding on WDIO_WORKER_ID avoids leaking an unused empty dir per worker.
const dataDir = process.env.WDIO_WORKER_ID
  ? ""
  : mkdtempSync(path.join(os.tmpdir(), "rookreader-e2e-"));

// E2E runs the RELEASE binary built with the `e2e-test` feature (which compiles in the
// embedded WebDriver plugin). Testing the optimized binary matches pre-migration behaviour.
const appBinary = path.join(
  process.cwd(),
  "src-tauri",
  "target",
  "release",
  `rook-reader${binaryExt}`,
);

export const config = {
  runner: "local",
  tsConfigPath: "tsconfig.json",
  specs: ["e2e/specs/**/*.ts"],
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
        // The embedded WebDriver server takes longer to come up (especially on
        // Windows); give it headroom and avoid false "unreachable — restarting".
        startTimeout: 60000,
        statusPollTimeout: 8000,
      },
    ],
  ],
  reporters: ["spec"],
  framework: "mocha",
  specFileRetries: process.env.CI ? 3 : 0,
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },

  // Build the RELEASE binary WITH the e2e-test feature (compiles in the WDIO plugins),
  // VITE_E2E=true (loads the @wdio/tauri-plugin frontend bridge into the webview), and the
  // E2E config overlay that enables withGlobalTauri (needed by the frontend bridge for
  // window-state/focus). The overlay is applied only here, so production keeps it disabled.
  onPrepare: () => {
    // Self-healing cleanup: remove any leftover data dirs from previous runs whose
    // onComplete could not delete them (the app briefly holds the SQLite file on exit).
    const tmp = os.tmpdir();
    for (const entry of readdirSync(tmp)) {
      if (entry.startsWith("rookreader-e2e-") && path.join(tmp, entry) !== dataDir) {
        removeDir(path.join(tmp, entry));
      }
    }

    const e2eConfig = path.join(process.cwd(), "src-tauri", "tauri.conf.e2e.json");
    spawnSync(
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
      {
        cwd: process.cwd(),
        stdio: "inherit",
        shell: true,
        env: { ...process.env, VITE_E2E: "true" },
      },
    );
  },

  // Remove the ephemeral data directory once the run completes. Any dir that can't be
  // deleted in time (Windows may hold the SQLite file briefly after shutdown) is swept by
  // the next run's onPrepare.
  onComplete: () => {
    if (dataDir) removeDir(dataDir);
  },
};
