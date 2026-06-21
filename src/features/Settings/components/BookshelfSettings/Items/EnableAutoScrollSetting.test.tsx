import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import EnableAutoScrollSetting from "./EnableAutoScrollSetting";

describe("EnableAutoScrollSetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should render with the current state from store", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.bookshelf.enableAutoScroll = true;

    renderWithProviders(<EnableAutoScrollSetting />, { preloadedState });

    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeChecked();
    expect(screen.getByText("Auto Scroll Text")).toBeInTheDocument();
  });

  it("should persist the changed leaf via set_settings when toggled", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.bookshelf.enableAutoScroll = false;

    const { store } = renderWithProviders(<EnableAutoScrollSetting />, { preloadedState });

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();

    await act(async () => {
      fireEvent.click(switchElement);
    });

    expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
      patch: { bookshelf: { enableAutoScroll: true } },
    });
    expect(store.getState().settings.bookshelf.enableAutoScroll).toBe(true);
  });
});
