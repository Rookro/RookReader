import { emit } from "@tauri-apps/api/event";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createBasePreloadedState, renderWithProviders } from "../../../../../test/utils";
import EnableAutoScrollSetting from "./EnableAutoScrollSetting";

// Mock Tauri emit
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
}));

describe("EnableAutoScrollSetting", () => {
  it("should render with the current state from store", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.bookshelf.enableAutoScroll = true;

    renderWithProviders(<EnableAutoScrollSetting />, { preloadedState });

    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeChecked();
    expect(screen.getByText("Auto Scroll Text")).toBeInTheDocument();
  });

  it("should dispatch updateSettings and emit tauri event when toggled", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.bookshelf.enableAutoScroll = false;

    const { store } = renderWithProviders(<EnableAutoScrollSetting />, {
      preloadedState,
    });

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();

    // Toggle the switch
    await act(async () => {
      fireEvent.click(switchElement);
    });

    // Verify Redux state
    expect(store.getState().settings.bookshelf.enableAutoScroll).toBe(true);

    // Verify Tauri emit was called
    expect(emit).toHaveBeenCalledWith(
      "settings-changed",
      expect.objectContaining({
        appSettings: {
          bookshelf: expect.objectContaining({
            enableAutoScroll: true,
          }),
        },
      }),
    );

    // Verify Redux state
    expect(store.getState().settings.bookshelf.enableAutoScroll).toBe(true);
  });
});
