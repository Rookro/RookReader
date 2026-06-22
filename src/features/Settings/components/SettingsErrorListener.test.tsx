import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import { ErrorCode } from "../../../types/Error";
import SettingsErrorListener from "./SettingsErrorListener";

const showNotification = vi.fn();
vi.mock("../../../components/ui/Notification/NotificationContext", () => ({
  useNotification: () => ({ showNotification }),
}));

describe("SettingsErrorListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a notification and clears the error when a settings error is present", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settingsError.error = {
      code: ErrorCode.SETTINGS_ERROR,
      message: "out of range",
    };

    const { store } = renderWithProviders(<SettingsErrorListener />, { preloadedState });

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        "Failed to save settings. Please check your input.",
        "error",
      );
      expect(store.getState().settingsError.error).toBeNull();
    });
  });

  it("does nothing when there is no settings error", () => {
    renderWithProviders(<SettingsErrorListener />);
    expect(showNotification).not.toHaveBeenCalled();
  });
});
