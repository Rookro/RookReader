import { vi } from "vitest";
import type { Api } from "../../bindings/api";

vi.mock("../../bindings/api", async () => {
  const { commands } =
    await vi.importActual<typeof import("../../bindings/bindings")>("../../bindings/bindings");
  const { api: actualApi } =
    await vi.importActual<typeof import("../../bindings/api")>("../../bindings/api");
  const actual = actualApi as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  // Settings tests fake the backend at `invoke` (`mockSettingsCommands`), so these reach it.
  const passThrough = new Set<string>(["getSettings", "setSettings"]);
  // What a command resolves to when an empty list does not suit.
  const defaultResults = {
    registerBook: () => 0,
    openBook: () => ({
      entries: [],
      isDirectory: false,
      isNovel: false,
      hasPreviews: false,
      book: null,
      recordError: null,
    }),
    getFonts: () => ["Arial", "Times New Roman"],
    isUpdaterSupported: () => true,
    claimUpdatePrompt: () => true,
  } satisfies { [K in keyof Api]?: () => Awaited<ReturnType<Api[K]>> };
  const defaults: Partial<Record<string, () => unknown>> = defaultResults;
  const api = Object.fromEntries(
    Object.keys(commands).map((name) => [
      name,
      passThrough.has(name)
        ? vi.fn(actual[name])
        : vi.fn(() => Promise.resolve(defaults[name]?.() ?? [])),
    ]),
  );
  return { api };
});

vi.mock("../../bindings/binaryCommands", () => ({
  getImage: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
  getImageFull: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
  getImagePreview: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
  readNovelFile: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
  getEntriesInDir: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
}));
