import { MenuItem } from "@mui/material";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/utils";
import SelectSettingItem from "./SelectSettingItem";

describe("SelectSettingItem", () => {
  it("should render correctly with given texts", () => {
    renderWithProviders(
      <SelectSettingItem
        primaryText="Test Title"
        secondaryText="Test Description"
        onChange={vi.fn()}
      >
        <MenuItem value="1">Option 1</MenuItem>
        <MenuItem value="2">Option 2</MenuItem>
      </SelectSettingItem>,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  it("should render icon if provided", () => {
    renderWithProviders(
      <SelectSettingItem
        primaryText="Test Title"
        icon={<div data-testid="test-icon" />}
        onChange={vi.fn()}
      >
        <MenuItem value="1">Option 1</MenuItem>
      </SelectSettingItem>,
    );

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });
});
