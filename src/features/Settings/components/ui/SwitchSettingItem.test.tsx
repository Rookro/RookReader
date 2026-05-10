import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/utils";
import SwitchSettingItem from "./SwitchSettingItem";

describe("SwitchSettingItem", () => {
  const user = userEvent.setup();

  it("should render correctly with given texts", () => {
    renderWithProviders(
      <SwitchSettingItem
        primaryText="Test Title"
        secondaryText="Test Description"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("should call onChange when toggled", async () => {
    const handleChange = vi.fn();
    renderWithProviders(<SwitchSettingItem primaryText="Test Title" onChange={handleChange} />);

    const switchControl = screen.getByRole("switch");
    await user.click(switchControl);

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("should respect checked state", () => {
    renderWithProviders(
      <SwitchSettingItem primaryText="Test Title" checked={true} onChange={vi.fn()} />,
    );

    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("should render icon if provided", () => {
    renderWithProviders(
      <SwitchSettingItem
        primaryText="Test Title"
        icon={<div data-testid="test-icon" />}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });
});
