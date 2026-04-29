import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockStore } from "../../../../../test/mocks/tauri";
import { createBasePreloadedState, renderWithProviders } from "../../../../../test/utils";
import LoupeSettingsItem from "./LoupeSettingsItem";

describe("LoupeSettingsItem", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.loupe = {
      zoom: 2.5,
      radius: 200,
      toggleKey: "Ctrl+M",
    };

    renderWithProviders(<LoupeSettingsItem />, { preloadedState });

    await waitFor(() => {
      const numericInputs = screen
        .getAllByRole("textbox")
        .filter((el) => el.getAttribute("inputmode") === "numeric");
      expect(numericInputs).toHaveLength(2);
      expect(numericInputs[0]).toHaveValue("2.5");
      expect(numericInputs[1]).toHaveValue("200");
    });

    const toggleKeyInput = screen
      .getAllByRole("textbox")
      .find((el) => el.getAttribute("name") === "toggleKey");
    expect(toggleKeyInput).toHaveValue("Ctrl+M");
  });

  it("should update store and emit event when zoom is changed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.loupe = { zoom: 2.0, radius: 150, toggleKey: "l" };

    const { store } = renderWithProviders(<LoupeSettingsItem />, { preloadedState });

    const textboxes = await screen.findAllByRole("textbox");
    const zoomInput = textboxes.filter((el) => el.getAttribute("inputmode") === "numeric")[0];

    await user.clear(zoomInput);
    await user.type(zoomInput, "3.5");
    await user.keyboard("{Enter}");
    zoomInput.blur();

    await waitFor(() => {
      expect(store.getState().settings.reader.comic.loupe.zoom).toBe(3.5);
      expect(mockStore.set).toHaveBeenCalledWith(
        "reader",
        expect.objectContaining({
          comic: expect.objectContaining({
            loupe: expect.objectContaining({ zoom: 3.5 }),
          }),
        }),
      );
    });
  });

  it("should update store and emit event when radius is changed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.loupe = { zoom: 2.0, radius: 150, toggleKey: "l" };

    const { store } = renderWithProviders(<LoupeSettingsItem />, { preloadedState });

    const textboxes = await screen.findAllByRole("textbox");
    const radiusInput = textboxes.filter((el) => el.getAttribute("inputmode") === "numeric")[1];

    await user.clear(radiusInput);
    await user.type(radiusInput, "250");
    await user.keyboard("{Enter}");
    radiusInput.blur();

    await waitFor(() => {
      expect(store.getState().settings.reader.comic.loupe.radius).toBe(250);
      expect(mockStore.set).toHaveBeenCalledWith(
        "reader",
        expect.objectContaining({
          comic: expect.objectContaining({
            loupe: expect.objectContaining({ radius: 250 }),
          }),
        }),
      );
    });
  });

  it("should update store when key combo is pressed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.loupe = { zoom: 2.0, radius: 150, toggleKey: "l" };

    const { store } = renderWithProviders(<LoupeSettingsItem />, { preloadedState });

    const textboxes = await screen.findAllByRole("textbox");
    const toggleKeyInput = textboxes.find((el) => el.getAttribute("name") === "toggleKey");

    if (toggleKeyInput) {
      await user.click(toggleKeyInput);
      await user.keyboard("{Shift>}{Control>}x{/Control}{/Shift}"); // Typing Ctrl+Shift+X
    }

    await waitFor(() => {
      expect(store.getState().settings.reader.comic.loupe.toggleKey).toBe("Ctrl+Shift+X");
    });
  });

  it("should blur and not update when Escape is pressed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.loupe = { zoom: 2.0, radius: 150, toggleKey: "l" };

    renderWithProviders(<LoupeSettingsItem />, { preloadedState });

    const toggleKeyInput = (await screen.findAllByRole("textbox")).find(
      (el) => el.getAttribute("name") === "toggleKey",
    );
    if (toggleKeyInput) {
      // Focus the input
      await act(async () => {
        toggleKeyInput.focus();
      });
      expect(toggleKeyInput).toHaveFocus();

      // Press Escape
      fireEvent.keyDown(toggleKeyInput, { key: "Escape" });

      // Should be blurred
      await waitFor(() => {
        expect(toggleKeyInput).not.toHaveFocus();
      });
    }
  });

  it("should ignore modifier-only keys", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.loupe = { zoom: 2.0, radius: 150, toggleKey: "l" };

    const { store } = renderWithProviders(<LoupeSettingsItem />, { preloadedState });

    const toggleKeyInput = (await screen.findAllByRole("textbox")).find(
      (el) => el.getAttribute("name") === "toggleKey",
    );
    if (toggleKeyInput) {
      await user.click(toggleKeyInput);
      await user.keyboard("{Control>}"); // Only Control
      await user.keyboard("{/Control}");
    }

    await waitFor(() => {
      expect(store.getState().settings.reader.comic.loupe.toggleKey).toBe("l"); // remains "l"
    });
  });
});
