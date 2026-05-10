import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AutocompleteSettingItem from "./AutocompleteSettingItem";

describe("AutocompleteSettingItem", () => {
  const options = [
    { label: "Option 1", value: "opt1" },
    { label: "Option 2", value: "opt2" },
  ];

  it("renders correctly with given value", () => {
    render(
      <AutocompleteSettingItem
        primaryText="Test Setting"
        options={options}
        value="opt2"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Test Setting")).toBeInTheDocument();
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("Option 2");
  });

  it("calls onChange when an option is selected", () => {
    const handleChange = vi.fn();
    render(
      <AutocompleteSettingItem
        primaryText="Test Setting"
        options={options}
        value="opt1"
        onChange={handleChange}
      />,
    );

    const input = screen.getByRole("combobox");

    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const option = screen.getByText("Option 2");
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith("opt2");
  });

  it("restores previous value on blur with invalid selection", () => {
    const handleChange = vi.fn();
    render(
      <AutocompleteSettingItem
        primaryText="Test Setting"
        options={options}
        value="opt1"
        onChange={handleChange}
      />,
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;

    input.focus();
    fireEvent.change(input, { target: { value: "Invalid Option" } });
    fireEvent.blur(input);

    expect(handleChange).not.toHaveBeenCalled();
    expect(input.value).toBe("Option 1");
  });
});
