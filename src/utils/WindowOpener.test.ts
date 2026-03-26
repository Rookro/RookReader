import { describe, it, expect, vi, beforeEach } from "vitest";
import { openSettingsWindow } from "./WindowOpener";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { error } from "@tauri-apps/plugin-log";

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: vi.fn(),
}));

describe("WindowOpener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new WebviewWindow for settings", () => {
    openSettingsWindow();
    expect(WebviewWindow).toHaveBeenCalledWith("settings", expect.objectContaining({
      url: "/#/settings",
      title: "Settings",
    }));
  });

  it("should log error if window creation fails", () => {
    vi.mocked(WebviewWindow).mockImplementation(() => {
      throw new Error("Creation failed");
    });

    openSettingsWindow();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to open settings window"));
  });
});
