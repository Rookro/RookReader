import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { createBasePreloadedState, renderWithProviders } from "../../../../../test/utils";
import AppFontFamilySetting from "./AppFontFamilySetting";

describe("AppFontFamilySetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render and load initial font from state", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.general.appFontFamily = "Arial";

    renderWithProviders(<AppFontFamilySetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Arial");
    });
  });
});
