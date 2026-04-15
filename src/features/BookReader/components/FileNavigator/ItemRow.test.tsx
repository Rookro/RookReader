import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockDirEntry } from "../../../../test/factories";
import { renderWithProviders } from "../../../../test/utils";
import { ItemRow } from "./ItemRow";

describe("FileNavigator/ItemRow", () => {
  const user = userEvent.setup();

  const mockFile = createMockDirEntry({
    name: "test-file.zip",
    is_directory: false,
  });

  const mockDir = createMockDirEntry({
    name: "test-folder",
    is_directory: true,
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

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(expect.anything(), mockFile, 5);
  });

  it("should call onDoubleClick with correct arguments when double-clicked", async () => {
    const onDoubleClick = vi.fn();
    renderWithProviders(
      <ItemRow entry={mockDir} index={0} selected={false} onDoubleClick={onDoubleClick} />,
    );

    await user.dblClick(screen.getByRole("button"));
    expect(onDoubleClick).toHaveBeenCalledWith(expect.anything(), mockDir);
  });

  it("should have Mui-selected class when selected is true", () => {
    renderWithProviders(<ItemRow entry={mockFile} index={0} selected={true} />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("Mui-selected");
  });
});
