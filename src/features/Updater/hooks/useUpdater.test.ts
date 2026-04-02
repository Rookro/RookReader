import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUpdater } from "./useUpdater";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isUpdaterSupported } from "../../../bindings/UpdaterCommands";

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

vi.mock("../../../bindings/UpdaterCommands", () => ({
  isUpdaterSupported: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      key + (params ? JSON.stringify(params) : ""),
  }),
}));

describe("useUpdater", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(isUpdaterSupported).mockResolvedValue(true);
    // we need to reset the global state to allow multiple act checks
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      result.current.handleCancelUpdate();
    });
  });

  it("should check for updates and show message when no update is available (manual check)", async () => {
    vi.mocked(check).mockResolvedValue(null);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(isUpdaterSupported).toHaveBeenCalled();
    expect(check).toHaveBeenCalled();
    expect(result.current.messageDialogOpen).toBe(true);
    expect(result.current.messageDialogText).toBe("updater.not-available");
  });

  it("should not show message when no update is available (auto check)", async () => {
    vi.mocked(check).mockResolvedValue(null);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(false);
    });

    expect(isUpdaterSupported).toHaveBeenCalled();
    expect(check).toHaveBeenCalled();
    expect(result.current.messageDialogOpen).toBe(false);
  });

  it("should handle unsupported platform (manual check)", async () => {
    vi.mocked(isUpdaterSupported).mockResolvedValue(false);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(isUpdaterSupported).toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
    expect(result.current.messageDialogOpen).toBe(true);
    expect(result.current.messageDialogText).toBe("updater.unsupported-platform");
  });

  it("should handle unsupported platform (auto check)", async () => {
    vi.mocked(isUpdaterSupported).mockResolvedValue(false);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(false);
    });

    expect(isUpdaterSupported).toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
    expect(result.current.messageDialogOpen).toBe(false);
  });

  it("should handle update available and set confirm dialog open", async () => {
    const mockUpdate = {
      version: "2.0.0",
      body: "Release notes",
    };

    vi.mocked(check).mockResolvedValue(mockUpdate as unknown as Update);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.confirmDialogOpen).toBe(true);
    expect(result.current.currentUpdate).toBe(mockUpdate);
  });

  it("should handle update confirmation", async () => {
    const mockDownloadAndInstall = vi.fn().mockImplementation(async (onEvent) => {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 50 } });
      onEvent({ event: "Progress", data: { chunkLength: 50 } });
      onEvent({ event: "Finished" });
    });

    const mockUpdate = {
      version: "2.0.0",
      body: "Release notes",
      downloadAndInstall: mockDownloadAndInstall,
    };

    vi.mocked(check).mockResolvedValue(mockUpdate as unknown as Update);

    const { result } = renderHook(() => useUpdater());

    // First check for updates
    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.confirmDialogOpen).toBe(true);

    // Then confirm
    await act(async () => {
      await result.current.handleConfirmUpdate();
    });

    expect(result.current.confirmDialogOpen).toBe(false);
    expect(mockDownloadAndInstall).toHaveBeenCalled();
    expect(relaunch).toHaveBeenCalled();
  });

  it("should handle update cancellation", async () => {
    const mockUpdate = {
      version: "2.0.0",
      body: "Release notes",
      downloadAndInstall: vi.fn(),
    };

    vi.mocked(check).mockResolvedValue(mockUpdate as unknown as Update);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.confirmDialogOpen).toBe(true);

    await act(async () => {
      result.current.handleCancelUpdate();
    });

    expect(result.current.confirmDialogOpen).toBe(false);
    expect(mockUpdate.downloadAndInstall).not.toHaveBeenCalled();
    expect(relaunch).not.toHaveBeenCalled();
  });
});
