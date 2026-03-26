import { vi } from "vitest";

export const mockTauri = {
  invoke: vi.fn(),
  listen: vi.fn(() => Promise.resolve(() => {})),
};

export const mockFs = {
  readFile: vi.fn(() => Promise.resolve(new Uint8Array())),
  writeFile: vi.fn(() => Promise.resolve()),
  readDir: vi.fn(() => Promise.resolve([])),
  mkdir: vi.fn(() => Promise.resolve()),
  exists: vi.fn(() => Promise.resolve(true)),
  remove: vi.fn(() => Promise.resolve()),
  watch: vi.fn(() => Promise.resolve(vi.fn())),
};

export const mockPath = {
  join: vi.fn((...args) => args.join("/").replace(/\/+/g, "/")),
  dirname: vi.fn((path) => path.split("/").slice(0, -1).join("/")),
  basename: vi.fn((path) => path.split("/").pop()),
};

export const mockDialog = {
  open: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve(null)),
  message: vi.fn(() => Promise.resolve()),
  ask: vi.fn(() => Promise.resolve(true)),
  confirm: vi.fn(() => Promise.resolve(true)),
};

export const mockLog = {
  info: vi.fn(() => Promise.resolve()),
  error: vi.fn(() => Promise.resolve()),
  warn: vi.fn(() => Promise.resolve()),
  debug: vi.fn(() => Promise.resolve()),
  trace: vi.fn(() => Promise.resolve()),
};

export const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
  save: vi.fn(),
};

export const mockApp = {
  getName: vi.fn(() => Promise.resolve("RookReader")),
  getVersion: vi.fn(() => Promise.resolve("1.0.0")),
  setTheme: vi.fn(() => Promise.resolve()),
};

class MockLazyStore {
  constructor() {}
  get = mockStore.get;
  set = mockStore.set;
  save = mockStore.save;
}

vi.mock("@tauri-apps/api/path", () => ({
  ...mockPath,
  homeDir: vi.fn(() => Promise.resolve("/mock/home")),
  appLogDir: vi.fn(() => Promise.resolve("/mock/logs")),
  resolveResource: vi.fn((path) => Promise.resolve(`/mock/resource/${path}`)),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(() => Promise.resolve()),
  openPath: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/app", () => mockApp);

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path) => `asset://${path}`),
  invoke: mockTauri.invoke,
}));

// Default mocks for setup.ts
vi.mock("@tauri-apps/api", () => ({
  invoke: mockTauri.invoke,
  listen: mockTauri.listen,
  app: mockApp,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mockTauri.listen,
  emit: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    onDragDropEvent: vi.fn(() => Promise.resolve(() => {})),
    label: "main",
  })),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => mockFs);
vi.mock("@tauri-apps/plugin-path", () => mockPath);
vi.mock("@tauri-apps/plugin-dialog", () => mockDialog);
vi.mock("@tauri-apps/plugin-log", () => mockLog);
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(() => Promise.resolve(mockStore)),
  LazyStore: MockLazyStore,
}));
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(() => Promise.resolve()),
}));
