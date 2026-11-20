import { alpha, createTheme } from "@mui/material";
import { createEvent, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/utils";
import { ItemRow } from "./ItemRow";

describe("ImageEntriesViewer/ItemRow", () => {
  const user = userEvent.setup();
  const mockEntry = "image-001.jpg";

  it("should render entry name correctly", () => {
    renderWithProviders(<ItemRow entry={mockEntry} index={0} selected={false} />);
    expect(screen.getByText("image-001.jpg")).toBeInTheDocument();
  });

  it("should show Image icon", () => {
    renderWithProviders(<ItemRow entry={mockEntry} index={0} selected={false} />);
    expect(screen.getByTestId("ImageIcon")).toBeInTheDocument();
  });

  it("should call onClick with correct arguments when clicked", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <ItemRow entry={mockEntry} index={10} selected={false} onClick={onClick} />,
    );

    await user.click(screen.getByRole("option"));
    expect(onClick).toHaveBeenCalledWith(expect.anything(), 10);
  });

  it("should apply selected styles when selected is true", () => {
    renderWithProviders(<ItemRow entry={mockEntry} index={0} selected={true} />);
    const button = screen.getByRole("option");
    expect(button).toHaveClass("Mui-selected");
  });

  it("is a listbox option that only the listbox focuses", () => {
    renderWithProviders(<ItemRow entry={mockEntry} index={0} selected={true} id="row-0" />);
    const option = screen.getByRole("option", { name: mockEntry });

    expect(option).toHaveAttribute("id", "row-0");
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(option).toHaveAttribute("tabindex", "-1");
    expect(option).not.toHaveClass("Mui-focusVisible");
  });

  it("draws the keyboard's active row as focused", () => {
    renderWithProviders(
      <ItemRow entry={mockEntry} index={0} selected={false} keyboardActive={true} />,
    );

    expect(screen.getByRole("option")).toHaveClass("Mui-focusVisible");
  });

  it("does not focus on a right-button mousedown", () => {
    renderWithProviders(<ItemRow entry={mockEntry} index={0} selected={false} />);
    const option = screen.getByRole("option");

    const right = createEvent.mouseDown(option, { button: 2, cancelable: true });
    fireEvent(option, right);

    expect(right.defaultPrevented).toBe(true);
  });

  it("should take the selected row color from the theme instead of overriding it", () => {
    const theme = createTheme();
    renderWithProviders(<ItemRow entry={mockEntry} index={0} selected={true} />);

    const backgroundColor = getComputedStyle(screen.getByRole("option")).backgroundColor;

    expect(backgroundColor).toBe(
      alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity),
    );
    expect(backgroundColor).not.toBe(theme.palette.action.selected);
  });
});
