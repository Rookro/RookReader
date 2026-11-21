import { createEvent, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockDirEntry } from "../../../../test/factories";
import { renderWithProviders } from "../../../../test/utils";
import { ItemRow } from "./ItemRow";

describe("FileNavigator/ItemRow", () => {
  const user = userEvent.setup();

  const mockFile = createMockDirEntry({
    name: "test-file.zip",
    isDirectory: false,
  });

  const mockDir = createMockDirEntry({
    name: "test-folder",
    isDirectory: true,
  });

  it("should render entry name correctly", () => {
    renderWithProviders(<ItemRow entry={mockFile} index={0} selected={false} />);
    expect(screen.getByText("test-file.zip")).toBeInTheDocument();
  });

  it("should show folder icon for directories", () => {
    renderWithProviders(<ItemRow entry={mockDir} index={0} selected={false} />);
    expect(screen.getByTestId("FolderOutlinedIcon")).toBeInTheDocument();
  });

  it("should not show folder icon for files", () => {
    renderWithProviders(<ItemRow entry={mockFile} index={0} selected={false} />);
    expect(screen.queryByTestId("FolderOutlinedIcon")).not.toBeInTheDocument();
  });

  it("should call onClick with correct arguments when clicked", async () => {
    const onClick = vi.fn();
    renderWithProviders(<ItemRow entry={mockFile} index={5} selected={false} onClick={onClick} />);

    await user.click(screen.getByRole("option"));
    expect(onClick).toHaveBeenCalledWith(expect.anything(), mockFile, 5);
  });

  it("should call onDoubleClick with correct arguments when double-clicked", async () => {
    const onDoubleClick = vi.fn();
    renderWithProviders(
      <ItemRow entry={mockDir} index={0} selected={false} onDoubleClick={onDoubleClick} />,
    );

    await user.dblClick(screen.getByRole("option"));
    expect(onDoubleClick).toHaveBeenCalledWith(expect.anything(), mockDir);
  });

  it("is a listbox option that only the listbox focuses", () => {
    renderWithProviders(<ItemRow entry={mockFile} index={0} selected={true} id="row-0" />);
    const option = screen.getByRole("option", { name: "test-file.zip" });

    expect(option).toHaveAttribute("id", "row-0");
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(option).toHaveAttribute("tabindex", "-1");
    expect(option).not.toHaveClass("Mui-focusVisible");
  });

  it("draws the keyboard's active row as focused", () => {
    renderWithProviders(
      <ItemRow entry={mockFile} index={0} selected={false} keyboardActive={true} />,
    );

    expect(screen.getByRole("option")).toHaveClass("Mui-focusVisible");
  });

  it("shows its tooltip while keyboard-active", () => {
    renderWithProviders(
      <ItemRow entry={mockFile} index={0} selected={false} keyboardActive={true} />,
    );

    expect(screen.getByRole("tooltip")).toHaveTextContent("test-file.zip");
  });

  it("does not take focus on a right-click", () => {
    renderWithProviders(<ItemRow entry={mockFile} index={0} selected={false} />);
    const row = screen.getByRole("option");

    const right = createEvent.mouseDown(row, { button: 2, cancelable: true });
    fireEvent(row, right);
    const left = createEvent.mouseDown(row, { button: 0, cancelable: true });
    fireEvent(row, left);

    expect(right.defaultPrevented).toBe(true);
    expect(left.defaultPrevented).toBe(false);
  });

  it("should have Mui-selected class when selected is true", () => {
    renderWithProviders(<ItemRow entry={mockFile} index={0} selected={true} />);
    const button = screen.getByRole("option");
    expect(button).toHaveClass("Mui-selected");
  });
});
