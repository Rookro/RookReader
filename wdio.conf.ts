import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const isWindows = os.platform() === "win32";
const binaryExt = isWindows ? ".exe" : "";

let tauriDriver: ReturnType<typeof spawn>;
let exit = false;

export const config = {
  runner: "local",
  tsConfigPath: "tsconfig.json",
  host: "127.0.0.1",
  port: 4444,
  specs: ["e2e/specs/**/*.ts"],
  services: [
    [
      "@wdio/tauri-service",
      {
        autoInstallTauriDriver: true,
      },
    ],
  ],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": {
        application: path.join(
          process.cwd(),
          "src-tauri",
          "target",
          "release",
          `rook-reader${binaryExt}`,
        ),
      },
    },
  ],
  reporters: ["spec"],
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },

  // ensure the rust project is built since we expect this binary to exist for the webdriver sessions
  onPrepare: () => {
    spawnSync("npm", ["run", "tauri", "build", "--", "--no-bundle"], {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: true,
    });
  },

  // ensure we are running `tauri-driver` before the session starts so that we can proxy the webdriver requests
  beforeSession: () => {
    const args = isWindows ? ["--native-driver", path.join(process.cwd(), "msedgedriver.exe")] : [];
    tauriDriver = spawn(path.resolve(os.homedir(), ".cargo", "bin", "tauri-driver"), args, {
      stdio: [null, process.stdout, process.stderr],
    });

    tauriDriver.on("error", (error) => {
      console.error("tauri-driver error:", error);
      process.exit(1);
    });
    tauriDriver.on("exit", (code) => {
      if (!exit) {
        console.error("tauri-driver exited with code:", code);
        process.exit(1);
      }
    });
  },

  // clean up the `tauri-driver` process we spawned at the start of the session
  // note that afterSession might not run if the session fails to start, so we also run the cleanup on shutdown
  afterSession: () => {
    closeTauriDriver();
  },
};

function closeTauriDriver() {
  exit = true;
  tauriDriver?.kill();
}

function onShutdown(fn) {
  const cleanup = () => {
    try {
      fn();
    } finally {
      process.exit();
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGHUP", cleanup);
  process.on("SIGBREAK", cleanup);
}

// ensure tauri-driver is closed when our test process exits
onShutdown(() => {
  closeTauriDriver();
});
