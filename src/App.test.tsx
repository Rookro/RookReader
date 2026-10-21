import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { createBasePreloadedState, renderWithProviders } from "./test/utils";
import { ErrorCode } from "./types/Error";

// MainView pulls in the whole app; stub it so this test covers only the shell.
vi.mock("./features/MainView/components/MainView", () => ({ default: () => null }));

describe("App", () => {
  it("shows a settings save error raised in the main window", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settingsError.error = { code: ErrorCode.settings, message: "out of range" };

    const { store } = renderWithProviders(<App />, { preloadedState });

    expect(
      await screen.findByText("Failed to save settings. (Error code: 50001)"),
    ).toBeInTheDocument();
    await waitFor(() => expect(store.getState().settingsError.error).toBeNull());
  });
});
