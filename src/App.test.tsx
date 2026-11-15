import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { api } from "./bindings/api";
import { errorReported } from "./store/errorNotificationSlice";
import { createBasePreloadedState, renderWithProviders } from "./test/utils";
import { ErrorCode } from "./types/Error";

// MainView pulls in the whole app; stub it so this test covers only the shell.
vi.mock("./features/MainView/components/MainView", () => ({ default: () => null }));

describe("App", () => {
  it("shows a settings save error raised in the main window", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.errorNotification.pending = [
      { context: "settings-save", code: ErrorCode.settings },
    ];

    const { store } = renderWithProviders(<App />, { preloadedState });

    expect(
      await screen.findByText("Failed to save settings. (Error code: 50001)"),
    ).toBeInTheDocument();
    await waitFor(() => expect(store.getState().errorNotification.pending).toEqual([]));
  });

  it("shows errors queued together as one notification", async () => {
    const { store } = renderWithProviders(<App />);

    act(() => {
      store.dispatch(errorReported({ context: "tag", code: ErrorCode.other }));
      store.dispatch(errorReported({ context: "series", code: ErrorCode.other }));
    });

    expect(
      await screen.findByText(/Tag operation failed\. \(Error code: 90001\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Series operation failed\. \(Error code: 90001\)/)).toBeInTheDocument();
  });

  it("tells the reader in the main window that the settings file could not be read", async () => {
    vi.mocked(api.isSettingsUnread).mockResolvedValueOnce(true);

    renderWithProviders(<App />);

    expect(await screen.findByText(/The settings file could not be read/)).toBeInTheDocument();
  });
});
