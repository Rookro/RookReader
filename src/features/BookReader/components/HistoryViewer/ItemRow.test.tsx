import { createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../../bindings/api";
import { createMockBookWithState } from "../../../../test/factories";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import { ItemRow } from "./ItemRow";

describe("HistoryViewer/ItemRow", () => {
  const user = userEvent.setup();

  const mockBook = createMockBookWithState({
    id: 1,
    filePath: "/path/to/book.zip",
    displayName: "Test Book",
  });

  const mockDir = createMockBookWithState({
    id: 2,
    filePath: "/path/to/folder",
    displayName: "Test Folder",
    itemType: "directory",
  });

  const preloadedState = createBasePreloadedState();
  preloadedState.history = {
    ...preloadedState.history,
    recentlyReadBooks: [mockBook, mockDir],
    status: "idle",
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

  it("does not focus the row on a right-button mousedown", () => {
    renderWithProviders(<ItemRow entry={mockBook} index={0} selected={false} />, {
      preloadedState,
    });
    const row = screen.getByRole("button");

    const right = createEvent.mouseDown(row, { button: 2, cancelable: true });
    fireEvent(row, right);
    const left = createEvent.mouseDown(row, { button: 0, cancelable: true });
    fireEvent(row, left);

    expect(right.defaultPrevented).toBe(true);
    expect(left.defaultPrevented).toBe(false);
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
      expect(api.clearReadingHistory).toHaveBeenCalledWith(mockBook.id);
    });
  });
  describe("last opened tooltip", () => {
    it("should format the stored UTC timestamp for the active locale", async () => {
      const entry = createMockBookWithState({
        id: 3,
        displayName: "Dated Book",
        lastOpenedAt: "2026-08-24T12:34:56Z",
      });
      const expected = new Date("2026-08-24T12:34:56Z").toLocaleString("en-US");

      renderWithProviders(<ItemRow entry={entry} index={0} selected={false} />, {
        preloadedState,
      });
      await user.hover(screen.getByText("Dated Book"));

      expect(await screen.findByRole("tooltip")).toHaveTextContent(`Last opened: ${expected}`);
    });

    it("should fall back to the raw value when the timestamp cannot be parsed", async () => {
      const entry = createMockBookWithState({
        id: 4,
        displayName: "Broken Book",
        lastOpenedAt: "not-a-date",
      });

      renderWithProviders(<ItemRow entry={entry} index={0} selected={false} />, {
        preloadedState,
      });
      await user.hover(screen.getByText("Broken Book"));

      expect(await screen.findByRole("tooltip")).toHaveTextContent("Last opened: not-a-date");
    });
  });
});
