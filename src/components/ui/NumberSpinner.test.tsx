import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/utils";
import NumberSpinner from "./NumberSpinner";

describe("NumberSpinner", () => {
  const user = userEvent.setup();

  afterEach(() => {
    cleanup();
  });

  // Verify that the label is displayed correctly
  it("should render with label", () => {
    renderWithProviders(<NumberSpinner label="Test Label" value={10} />);
    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  // Verify that increment and decrement buttons are displayed
  it("should render increment and decrement buttons", () => {
    renderWithProviders(<NumberSpinner label="Test Label" value={10} />);
    expect(screen.getByLabelText("Increase")).toBeInTheDocument();
    expect(screen.getByLabelText("Decrease")).toBeInTheDocument();
  });

  // Verify that the current value is correctly displayed in the input field
  it("should display the current value", () => {
    renderWithProviders(<NumberSpinner label="Test Label" value={42} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("42");
  });

  // Verify that onValueChange callback is called when the value is updated
  it("should call onValueChange when value is updated via buttons", async () => {
    const onValueChange = vi.fn();
    renderWithProviders(
      <NumberSpinner label="Test Label" value={10} onValueChange={onValueChange} />,
    );

    const increaseButton = screen.getByLabelText("Increase");
    await user.click(increaseButton);
    expect(onValueChange).toHaveBeenCalledWith(11, expect.anything());

    const decreaseButton = screen.getByLabelText("Decrease");
    await user.click(decreaseButton);
    expect(onValueChange).toHaveBeenCalledWith(9, expect.anything());
  });

  it("should respect min and max boundaries and disable buttons", async () => {
    const onValueChange = vi.fn();
    const { rerender } = renderWithProviders(
      <NumberSpinner label="Test Label" value={1} min={1} max={2} onValueChange={onValueChange} />,
    );

    const decreaseButton = screen.getByLabelText("Decrease");
    const increaseButton = screen.getByLabelText("Increase");

    expect(decreaseButton).toBeDisabled();
    expect(increaseButton).not.toBeDisabled();

    await user.click(increaseButton);
    expect(onValueChange).toHaveBeenCalledWith(2, expect.anything());

    // Re-render with value=2 to check disabled state of increase button
    rerender(
      <NumberSpinner label="Test Label" value={2} min={1} max={2} onValueChange={onValueChange} />,
    );
    expect(screen.getByLabelText("Increase")).toBeDisabled();
    expect(screen.getByLabelText("Decrease")).not.toBeDisabled();
  });

  it("should handle keyboard input and clamp to boundaries on blur", async () => {
    const onValueChange = vi.fn();
    renderWithProviders(
      <NumberSpinner label="Test Label" value={5} min={0} max={10} onValueChange={onValueChange} />,
    );

    const input = screen.getByRole("textbox");

    // Type a value out of bounds
    await user.clear(input);
    await user.type(input, "99");
    await user.tab(); // Blur trigger

    // Check for 10 being passed to onValueChange
    expect(onValueChange).toHaveBeenCalledWith(10, expect.anything());
  });

  // Verify that the input and buttons are disabled when the disabled prop is true
  it("should be disabled when disabled prop is true", () => {
    renderWithProviders(<NumberSpinner label="Test Label" value={10} disabled />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeDisabled();

    const increaseButton = screen.getByLabelText("Increase");
    const decreaseButton = screen.getByLabelText("Decrease");
    expect(increaseButton).toBeDisabled();
    expect(decreaseButton).toBeDisabled();
  });

  it("should render in error state with helper text", () => {
    renderWithProviders(
      <NumberSpinner label="Test Label" value={10} error helperText="Error occurred" />,
    );
    expect(screen.getByText("Error occurred")).toBeInTheDocument();
    // Material UI typically adds Mui-error class
    const helperText = screen.getByText("Error occurred");
    expect(helperText).toHaveClass("Mui-error");
  });

  it("should use provided id", () => {
    renderWithProviders(<NumberSpinner id="custom-id" label="Test Label" value={10} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("id", "custom-id");
  });

  it("should apply custom sx styles", () => {
    const { container } = renderWithProviders(
      <NumberSpinner label="Test" value={10} sx={{ mt: "20px" }} />,
    );
    const formControl = container.querySelector(".MuiFormControl-root");
    expect(formControl).toHaveStyle("margin-top: 20px");
  });

  it("should apply sx styles as array", () => {
    const { container } = renderWithProviders(
      <NumberSpinner label="Test" value={10} sx={[{ mt: "20px" }, { ml: "10px" }]} />,
    );
    const formControl = container.querySelector(".MuiFormControl-root");
    expect(formControl).toHaveStyle("margin-top: 20px");
    expect(formControl).toHaveStyle("margin-left: 10px");
  });
});
