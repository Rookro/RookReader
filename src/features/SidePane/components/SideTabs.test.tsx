import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/utils";
import SideTabs from "./SideTabs";

describe("SideTabs", () => {
  const user = userEvent.setup();

  const mockTabs = [
    { label: "Tab 1", icon: <span data-testid="icon-1" />, panel: <div /> },
    { label: "Tab 2", icon: <span data-testid="icon-2" />, panel: <div /> },
  ];

  it("should render tabs correctly", () => {
    renderWithProviders(<SideTabs tabs={mockTabs} tabIndex={0} isHidden={false} />);
    expect(screen.getByLabelText("Tab 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Tab 2")).toBeInTheDocument();
  });

  it("should dispatch setLeftSideTabIndex and setIsLeftSidePanelsHidden(false) when a different tab is clicked", async () => {
    const { store } = renderWithProviders(
      <SideTabs tabs={mockTabs} tabIndex={0} isHidden={true} />,
    );

    const tab2 = screen.getByLabelText("Tab 2");
    await user.click(tab2);

    expect(store.getState().sidePane.left.tabIndex).toBe(1);
    expect(store.getState().sidePane.left.isHidden).toBe(false);
  });

  it("should toggle visibility when the same tab is clicked (visible -> hidden)", async () => {
    const { store } = renderWithProviders(
      <SideTabs tabs={mockTabs} tabIndex={0} isHidden={false} />,
    );
    await user.click(screen.getByLabelText("Tab 1"));
    expect(store.getState().sidePane.left.isHidden).toBe(true);
  });

  it("should toggle visibility when the same tab is clicked (hidden -> visible)", async () => {
    const { store } = renderWithProviders(
      <SideTabs tabs={mockTabs} tabIndex={0} isHidden={true} />,
    );
    await user.click(screen.getByLabelText("Tab 1"));
    expect(store.getState().sidePane.left.isHidden).toBe(false);
  });

  it("should reset tabIndex if current index is out of bounds", () => {
    const { store } = renderWithProviders(
      <SideTabs tabs={mockTabs} tabIndex={5} isHidden={false} />,
    );
    expect(store.getState().sidePane.left.tabIndex).toBe(0);
  });
});
