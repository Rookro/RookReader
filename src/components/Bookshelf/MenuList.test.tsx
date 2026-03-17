import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MenuList from "./MenuList";
import { renderWithProviders, RootState } from "../../test/utils";
import {
  changeBookshelf,
  setSelectedTag,
  removeBookshelf,
  removeTag,
} from "../../reducers/BookCollectionReducer";
import { setActiveView } from "../../reducers/ViewReducer";

vi.mock("../../reducers/BookCollectionReducer", async () => {
  const actual = await vi.importActual("../../reducers/BookCollectionReducer");
  return {
    ...actual,
    changeBookshelf: vi.fn((id) => ({ type: "changeBookshelf", payload: id })),
    setSelectedTag: vi.fn((id) => ({ type: "setSelectedTag", payload: id })),
    removeBookshelf: vi.fn((id) => ({ type: "removeBookshelf", payload: id })),
    removeTag: vi.fn((id) => ({ type: "removeTag", payload: id })),
  };
});

vi.mock("../../reducers/ViewReducer", async () => {
  const actual = await vi.importActual("../../reducers/ViewReducer");
  return {
    ...actual,
    setActiveView: vi.fn((view) => ({ type: "setActiveView", payload: view })),
  };
});

describe("MenuList", () => {
  const user = userEvent.setup();

  const mockBookshelves = [{ id: 1, name: "Bookshelf 1", icon_id: "folder", created_at: "" }];
  const mockTags = [{ id: 10, name: "Tag 1", color_code: "#ff0000" }];

  const preloadedState: Partial<RootState> = {
    bookCollection: {
      bookshelf: {
        bookshelves: mockBookshelves,
        selectedId: null,
        books: [],
        status: "idle",
        error: null,
      },
      tag: { tags: mockTags, selectedId: null, status: "idle", error: null },
      series: { series: [], selectedId: null, books: [], status: "idle", error: null },
      searchText: "",
      sortOrder: "NAME_ASC",
      gridSize: 1,
    },
  };

  const defaultProps = {
    onClickAddBookshelf: vi.fn(),
    onClickAddBookTag: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that "All Books", bookshelf list, and tag list are displayed correctly
  it("should render all books, bookshelves and tags", () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    expect(screen.getByText("All Books")).toBeInTheDocument();
    expect(screen.getByText("Bookshelf 1")).toBeInTheDocument();
    expect(screen.getByText("Tag 1")).toBeInTheDocument();
  });

  // Verify that changeBookshelf action is called correctly when a bookshelf is clicked
  it("should call changeBookshelf when a bookshelf is clicked", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    await user.click(screen.getByText("Bookshelf 1"));
    expect(changeBookshelf).toHaveBeenCalledWith(1);
  });

  // Verify that setSelectedTag action is called correctly when a tag is clicked
  it("should call setSelectedTag when a tag is clicked", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    await user.click(screen.getByText("Tag 1"));
    expect(setSelectedTag).toHaveBeenCalledWith(10);
  });

  // Verify that setActiveView action is called correctly when return to reader is clicked
  it("should call setActiveView when return to reader is clicked", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    const backButton = screen.getByLabelText("Return to reader");
    await user.click(backButton);
    expect(setActiveView).toHaveBeenCalledWith("reader");
  });

  // Verify that context menu is shown for bookshelf and delete operation is handled correctly
  it("should show context menu and handle delete for bookshelf", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    const bookshelfItem = screen.getByText("Bookshelf 1");

    // Right click to show context menu
    await user.pointer({ keys: "[MouseRight]", target: bookshelfItem });

    const deleteButton = screen.getByText("Delete");
    expect(deleteButton).toBeInTheDocument();

    await user.click(deleteButton);
    expect(removeBookshelf).toHaveBeenCalledWith(1);
  });

  // Verify that context menu is shown for tag and delete operation is handled correctly
  it("should show context menu and handle delete for tag", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    const tagItem = screen.getByText("Tag 1");

    await user.pointer({ keys: "[MouseRight]", target: tagItem });

    const deleteButton = screen.getByText("Delete");
    await user.click(deleteButton);
    expect(removeTag).toHaveBeenCalledWith(10);
  });
});
