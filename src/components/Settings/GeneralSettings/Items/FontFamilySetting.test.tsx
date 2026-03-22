import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import FontFamilySetting from "./FontFamilySetting";

describe("FontFamilySetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render and load initial font from state", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings["font-family"] = "Arial";

    renderWithProviders(<FontFamilySetting />, { preloadedState });

    await waitFor(() => {
      // The Select component shows the value.
      // Arial is in our global mock list in tauri.ts
      expect(screen.getByRole("combobox")).toHaveTextContent("Arial");
    });
  });
});
