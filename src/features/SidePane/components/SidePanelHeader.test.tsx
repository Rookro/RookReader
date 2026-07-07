import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSettingsCommands, renderWithProviders } from "../../../test/utils";
import SidePanelHeader from "./SidePanelHeader";

describe("SidePanelHeader", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should render title correctly", () => {
    renderWithProviders(<SidePanelHeader title="Test Title" />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("should update layout settings when close button is clicked", async () => {
    const { store } = renderWithProviders(<SidePanelHeader title="Test Title" />);

    const closeButton = screen.getByRole("button");
    await user.click(closeButton);

    expect(store.getState().settings.layout.sidePane.isHidden).toBe(true);
  });
});
