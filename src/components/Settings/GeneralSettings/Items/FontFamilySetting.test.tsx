import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../../test/utils";
import FontFamilySetting from "./FontFamilySetting";
import { mockStore } from "../../../../test/mocks/tauri";

describe("FontFamilySetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render and load initial font from store", async () => {
    mockStore.get.mockResolvedValue("Arial");

    renderWithProviders(<FontFamilySetting />);

    await waitFor(() => {
      // The Select component shows the value.
      // Arial is in our global mock list in tauri.ts
      expect(screen.getByRole("combobox")).toHaveTextContent("Arial");
    });
  });
});
