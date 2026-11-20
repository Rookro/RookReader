import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import SidePanels from "./SidePanels";

describe("SidePanels", () => {
  const mockTabs = [
    { label: "Tab 1", icon: <span />, panel: <div data-testid="panel-1">Panel 1 Content</div> },
    { label: "Tab 2", icon: <span />, panel: <div data-testid="panel-2">Panel 2 Content</div> },
  ];

  it("should render active panel correctly", () => {
    // Show first panel
    renderWithProviders(<SidePanels tabs={mockTabs} index={0} isHidden={false} />);
    expect(screen.getByTestId("panel-1")).toBeInTheDocument();
    expect(screen.queryByTestId("panel-2")).not.toBeInTheDocument();

    // Show second panel
    renderWithProviders(<SidePanels tabs={mockTabs} index={1} isHidden={false} />);
    expect(screen.getByTestId("panel-2")).toBeInTheDocument();
  });

  it("marks its container as the side pane, inert while the pane is hidden", () => {
    const { container, rerender } = renderWithProviders(
      <SidePanels tabs={mockTabs} index={0} isHidden={true} />,
    );
    const panels = container.firstElementChild;
    expect(panels).toHaveAttribute("data-side-pane");
    expect(panels).toHaveAttribute("inert");

    rerender(<SidePanels tabs={mockTabs} index={0} isHidden={false} />);
    expect(panels).not.toHaveAttribute("inert");
  });
});
