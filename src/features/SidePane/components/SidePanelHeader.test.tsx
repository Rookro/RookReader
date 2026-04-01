import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/utils";
import SidePanelHeader from "./SidePanelHeader";

describe("SidePanelHeader", () => {
  const user = userEvent.setup();

  it("should render title correctly", () => {
    renderWithProviders(<SidePanelHeader title="Test Title" />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("should dispatch setIsLeftSidePanelsHidden(true) when close button is clicked", async () => {
    const { store } = renderWithProviders(<SidePanelHeader title="Test Title" />);

    const closeButton = screen.getByRole("button");
    await user.click(closeButton);

    expect(store.getState().sidePane.left.isHidden).toBe(true);
  });
});
