import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("disables the increment button at max", () => {
    renderWithProviders(
      <NumberSpinnerSettingItem
        primaryText="Test Title"
        defaultValue={65535}
        min={0}
        max={65535}
        onValueCommitted={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Increase")).toBeDisabled();
    expect(screen.getByLabelText("Decrease")).not.toBeDisabled();
  });

  it("disables the decrement button at min", () => {
    renderWithProviders(
      <NumberSpinnerSettingItem
        primaryText="Test Title"
        defaultValue={0}
        min={0}
        max={65535}
        onValueCommitted={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Decrease")).toBeDisabled();
    expect(screen.getByLabelText("Increase")).not.toBeDisabled();
  });

  it("forwards allowOutOfRange: a typed value beyond max reaches onValueCommitted unclamped", async () => {
    const user = userEvent.setup();
    const onValueCommitted = vi.fn();
    renderWithProviders(
      <NumberSpinnerSettingItem
        primaryText="Test Title"
        defaultValue={100}
        min={0}
        max={200}
        onValueCommitted={onValueCommitted}
      />,
    );

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "500");
    await user.tab(); // Blur commits the value.

    // Without allowOutOfRange the value would be clamped to 200; here it passes through so
    // the backend can validate and surface an inline message.
    expect(onValueCommitted.mock.calls.at(-1)?.[0]).toBe(500);
  });
});
