import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isUpdaterSupported } from "../../../bindings/UpdaterCommands";
import { useUpdater } from "./useUpdater";

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

  it("should handle error during update check (manual check)", async () => {
    const errorMsg = "Network error";
    vi.mocked(check).mockRejectedValue(new Error(errorMsg));

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.messageDialogOpen).toBe(true);
    expect(result.current.messageDialogIsError).toBe(true);
    expect(result.current.messageDialogText).toContain("updater.checking-error");
    expect(result.current.messageDialogText).toContain(errorMsg);
  });

  it("should handle error during update check (auto check)", async () => {
    vi.mocked(check).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(false);
    });

    // Auto check should not show message dialog on error
    expect(result.current.messageDialogOpen).toBe(false);
  });

  it("should handle error during download and install", async () => {
    const errorMsg = "Download failed";
    const mockDownloadAndInstall = vi.fn().mockRejectedValue(new Error(errorMsg));

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

    // Then confirm and expect error
    await act(async () => {
      await result.current.handleConfirmUpdate();
    });

    expect(result.current.isUpdating).toBe(false);
    expect(result.current.messageDialogOpen).toBe(true);
    expect(result.current.messageDialogIsError).toBe(true);
    expect(result.current.messageDialogText).toContain("updater.installing-error");
    expect(result.current.messageDialogText).toContain(errorMsg);
    expect(relaunch).not.toHaveBeenCalled();
  });

  it("should handle error when relaunch fails", async () => {
    const mockDownloadAndInstall = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = {
      version: "2.0.0",
      body: "Release notes",
      downloadAndInstall: mockDownloadAndInstall,
    };

    vi.mocked(check).mockResolvedValue(mockUpdate as unknown as Update);
    const errorMsg = "Relaunch failed";
    vi.mocked(relaunch).mockRejectedValue(new Error(errorMsg));

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    await act(async () => {
      await result.current.handleConfirmUpdate();
    });

    expect(result.current.messageDialogOpen).toBe(true);
    expect(result.current.messageDialogText).toContain("updater.installing-error");
    expect(result.current.messageDialogText).toContain(errorMsg);
  });

  it("should handle error when isUpdaterSupported throws", async () => {
    const errorMsg = "Platform check failed";
    vi.mocked(isUpdaterSupported).mockRejectedValue(new Error(errorMsg));

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.messageDialogOpen).toBe(true);
    expect(result.current.messageDialogText).toContain(errorMsg);
  });

  it("should prevent concurrent update checks using isCheckingGlobal", async () => {
    // Mock check to be slow
    let resolveCheck: (value: Update | null) => void;
    const checkPromise = new Promise<Update | null>((resolve) => {
      resolveCheck = resolve;
    });
    vi.mocked(check).mockReturnValue(checkPromise);

    const { result } = renderHook(() => useUpdater());

    // Start first check
    let firstCheckPromise: Promise<void>;
    await act(async () => {
      firstCheckPromise = result.current.checkForUpdates(true);
    });

    // Start second check while first is still running
    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    // Only one check should have been initiated
    expect(isUpdaterSupported).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledTimes(1);

    // Resolve first check
    await act(async () => {
      resolveCheck(null);
      await firstCheckPromise;
    });

    // Now a second check should be possible
    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(isUpdaterSupported).toHaveBeenCalledTimes(2);
    expect(check).toHaveBeenCalledTimes(2);
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

  it("should close message dialog", async () => {
    vi.mocked(isUpdaterSupported).mockResolvedValue(false);
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.messageDialogOpen).toBe(true);

    await act(async () => {
      result.current.closeMessageDialog();
    });

    expect(result.current.messageDialogOpen).toBe(false);
  });

  it("should handle handleConfirmUpdate when currentUpdate is null", async () => {
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.handleConfirmUpdate();
    });

    expect(result.current.isUpdating).toBe(false);
  });

  it("should handle Progress event when contentLength is 0", async () => {
    const mockDownloadAndInstall = vi.fn().mockImplementation(async (onEvent) => {
      onEvent({ event: "Started", data: { contentLength: 0 } });
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

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    await act(async () => {
      await result.current.handleConfirmUpdate();
    });

    expect(result.current.updateProgress).toBe(0);
    expect(relaunch).toHaveBeenCalled();
  });
});
