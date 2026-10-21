import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { error } from "@tauri-apps/plugin-log";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openSettingsWindow } from "./WindowOpener";

const once = vi.fn();

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: Object.assign(
    vi.fn(
      class {
        once = once;
      },
    ),
    { getByLabel: vi.fn() },
  ),
}));

describe("WindowOpener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(WebviewWindow.getByLabel).mockResolvedValue(null);
  });

  it("should create a new WebviewWindow for settings", async () => {
    await openSettingsWindow("Settings");
    expect(WebviewWindow).toHaveBeenCalledWith(
      "settings",
      expect.objectContaining({
        url: "/#/settings",
        title: "Settings",
      }),
    );
  });

  it("brings an open settings window to the front instead of creating another", async () => {
    const existing = { unminimize: vi.fn(), setFocus: vi.fn() };
    vi.mocked(WebviewWindow.getByLabel).mockResolvedValue(existing as unknown as WebviewWindow);

    await openSettingsWindow("Settings");

    expect(WebviewWindow.getByLabel).toHaveBeenCalledWith("settings");
    expect(existing.unminimize).toHaveBeenCalled();
    expect(existing.setFocus).toHaveBeenCalled();
    expect(WebviewWindow).not.toHaveBeenCalled();
  });

  it("logs a failure to create the window", async () => {
    await openSettingsWindow("Settings");

    expect(once).toHaveBeenCalledWith("tauri://error", expect.any(Function));
    const onError = once.mock.calls[0][1] as (event: { payload: unknown }) => void;
    onError({ payload: "already exists" });
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to open the settings window"),
    );
  });

  it("logs a failure to bring the open window to the front", async () => {
    const existing = {
      unminimize: vi.fn(() => Promise.reject(new Error("window closed"))),
      setFocus: vi.fn(),
    };
    vi.mocked(WebviewWindow.getByLabel).mockResolvedValue(existing as unknown as WebviewWindow);

    await openSettingsWindow("Settings");

    expect(error).toHaveBeenCalledWith(expect.stringContaining("window closed"));
  });
});
