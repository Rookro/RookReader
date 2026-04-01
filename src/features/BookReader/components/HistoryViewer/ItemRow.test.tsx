import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import { ItemRow } from "./ItemRow";
import * as BookCommands from "../../../../bindings/BookCommands";
import { createMockReadBook } from "../../../../test/factories";

// Mock BookCommands
describe("HistoryViewer/ItemRow", () => {
  const user = userEvent.setup();

  const mockBook = createMockReadBook({
    id: 1,
    file_path: "/path/to/book.zip",
    display_name: "Test Book",
  });

  const mockDir = createMockReadBook({
    id: 2,
    file_path: "/path/to/folder",
    display_name: "Test Folder",
    item_type: "directory",
  });

  const preloadedState = createBasePreloadedState();
  preloadedState.history = {
    ...preloadedState.history,
    recentlyReadBooks: [mockBook, mockDir],
    status: "idle",
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render display name correctly", () => {
    renderWithProviders(<ItemRow entry={mockBook} index={0} selected={false} />, {
      preloadedState,
    });
    expect(screen.getByText("Test Book")).toBeInTheDocument();
  });

  it("should show folder icon for directory items", () => {
    renderWithProviders(<ItemRow entry={mockDir} index={1} selected={false} />, { preloadedState });
    expect(screen.getByTestId("FolderOutlinedIcon")).toBeInTheDocument();
  });

  it("should call onClick with correct arguments when clicked", async () => {
    const onClick = vi.fn();
    renderWithProviders(<ItemRow entry={mockBook} index={0} selected={false} onClick={onClick} />, {
      preloadedState,
    });

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(expect.anything(), mockBook, 0);
  });

  it("should open context menu on right click", async () => {
    renderWithProviders(<ItemRow entry={mockBook} index={0} selected={false} />, {
      preloadedState,
    });

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Test Book") });

    // Check if menu items are visible
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Remove history")).toBeInTheDocument();
  });

  it("should have Mui-selected class when selected is true", () => {
    renderWithProviders(<ItemRow entry={mockBook} index={0} selected={true} />, {
      preloadedState,
    });
    const button = screen.getByRole("button");
    expect(button).toHaveClass("Mui-selected");
  });

  it("should call onClick when 'Open' is clicked in context menu", async () => {
    const onClick = vi.fn();
    renderWithProviders(<ItemRow entry={mockBook} index={0} selected={false} onClick={onClick} />, {
      preloadedState,
    });

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Test Book") });
    const openButton = screen.getByText("Open");
    await user.click(openButton);

    expect(onClick).toHaveBeenCalledWith(expect.anything(), mockBook, 0);
  });

  it("should call clearReadingHistory when 'Remove history' is clicked in context menu", async () => {
    renderWithProviders(<ItemRow entry={mockBook} index={0} selected={false} />, {
      preloadedState,
    });

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Test Book") });
    const removeButton = screen.getByText("Remove history");
    await user.click(removeButton);

    await waitFor(() => {
      expect(BookCommands.clearReadingHistory).toHaveBeenCalledWith(mockBook.id);
    });
  });
});
