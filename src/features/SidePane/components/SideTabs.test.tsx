import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSettingsCommands, renderWithProviders } from "../../../test/utils";
import SideTabs from "./SideTabs";

describe("SideTabs", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  const mockTabs = [
    { label: "Tab 1", icon: <span data-testid="icon-1" />, panel: <div /> },
    { label: "Tab 2", icon: <span data-testid="icon-2" />, panel: <div /> },
  ];

  it("should render tabs correctly", () => {
    renderWithProviders(<SideTabs tabs={mockTabs} index={0} isHidden={false} />);
    expect(screen.getByLabelText("Tab 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Tab 2")).toBeInTheDocument();
  });

  it("should update layout settings when a different tab is clicked", async () => {
    const { store } = renderWithProviders(<SideTabs tabs={mockTabs} index={0} isHidden={true} />);

    const tab2 = screen.getByLabelText("Tab 2");
    await user.click(tab2);

    expect(store.getState().settings.layout.sidePane.tabIndex).toBe(1);
    expect(store.getState().settings.layout.sidePane.isHidden).toBe(false);
  });

  it("should toggle visibility when the same tab is clicked (visible -> hidden)", async () => {
    const { store } = renderWithProviders(<SideTabs tabs={mockTabs} index={0} isHidden={false} />);
    await user.click(screen.getByLabelText("Tab 1"));
    expect(store.getState().settings.layout.sidePane.isHidden).toBe(true);
  });

  it("should toggle visibility when the same tab is clicked (hidden -> visible)", async () => {
    const { store } = renderWithProviders(<SideTabs tabs={mockTabs} index={0} isHidden={true} />);
    await user.click(screen.getByLabelText("Tab 1"));
    expect(store.getState().settings.layout.sidePane.isHidden).toBe(false);
  });

  it("should reset tabIndex if current index is out of bounds", () => {
    const { store } = renderWithProviders(<SideTabs tabs={mockTabs} index={5} isHidden={false} />);
    expect(store.getState().settings.layout.sidePane.tabIndex).toBe(0);
  });
});
