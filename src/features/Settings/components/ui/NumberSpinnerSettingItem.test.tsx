import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/utils";
import NumberSpinnerSettingItem from "./NumberSpinnerSettingItem";

describe("NumberSpinnerSettingItem", () => {
  it("should render correctly with given texts", () => {
    renderWithProviders(
      <NumberSpinnerSettingItem
        primaryText="Test Title"
        secondaryText="Test Description"
        defaultValue={10}
        onValueCommitted={vi.fn()}
      />,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("10");
  });

  it("should render icon if provided", () => {
    renderWithProviders(
      <NumberSpinnerSettingItem
        primaryText="Test Title"
        icon={<div data-testid="test-icon" />}
        defaultValue={10}
        onValueCommitted={vi.fn()}
      />,
    );

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("should render unit if provided", () => {
    renderWithProviders(
      <NumberSpinnerSettingItem
        primaryText="Test Title"
        defaultValue={10}
        unit="px"
        onValueCommitted={vi.fn()}
      />,
    );

    expect(screen.getByText("px")).toBeInTheDocument();
  });

  it("should display helper text when error is true", () => {
    renderWithProviders(
      <NumberSpinnerSettingItem
        primaryText="Test Title"
        defaultValue={10}
        error={true}
        helperText="Error message"
        onValueCommitted={vi.fn()}
      />,
    );

    expect(screen.getByText("Error message")).toBeInTheDocument();
  });
});
