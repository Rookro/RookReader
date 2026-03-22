import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../test/utils";
import Bookshelf from "./Bookshelf";
import { JSX } from "react";
import * as BookCollectionReducer from "../../reducers/BookCollectionReducer";
import * as ReadReducer from "../../reducers/ReadReducer";
import * as ViewReducer from "../../reducers/ViewReducer";
import { error } from "@tauri-apps/plugin-log";
import { createMockBookWithState } from "../../test/factories";
import { BookWithState } from "../../types/DatabaseModels";

// Mock sub-components
vi.mock("./BookGrid", () => {
  const BookGrid = ({ onBookSelect }: { onBookSelect: (book: BookWithState) => void }) => (
    <div data-testid="book-grid">
      <button
        data-testid="select-book-btn"
        onClick={() =>
          onBookSelect(createMockBookWithState({ id: 123, file_path: "/test/book.zip" }))
        }
      >
        Select Book
      </button>
    </div>
  );
  BookGrid.displayName = "BookGrid";
  return { default: BookGrid };
});

vi.mock("./MenuList", () => {
  const MenuList = ({
    onClickAddBookshelf,
    onClickAddBookTag,
  }: {
    onClickAddBookshelf: () => void;
    onClickAddBookTag: () => void;
  }): JSX.Element => (
    <div data-testid="menu-list">
      <button data-testid="add-shelf-btn" onClick={onClickAddBookshelf}>
        Add Shelf
      </button>
      <button data-testid="add-tag-btn" onClick={onClickAddBookTag}>
        Add Tag
      </button>
    </div>
  );
  MenuList.displayName = "MenuList";
  return { default: MenuList };
});

vi.mock("./Dialog/CreateBookshelfDialog", () => {
  const CreateBookshelfDialog = ({
    openDialog,
    onCreate,
  }: {
    openDialog: boolean;
    onCreate: (name: string, icon_id: string) => void;
  }): JSX.Element | null =>
    openDialog ? (
      <div data-testid="create-bookshelf-dialog">
        <button data-testid="confirm-create-shelf" onClick={() => onCreate("New Shelf", "icon-1")}>
          Confirm
        </button>
      </div>
    ) : null;
  CreateBookshelfDialog.displayName = "CreateBookshelfDialog";
  return { CreateBookshelfDialog };
});

vi.mock("./Dialog/CreateBookTagDialog", () => {
  const CreateBookTagDialog = ({
    openDialog,
    onCreate,
  }: {
    openDialog: boolean;
    onCreate: (name: string, color_code: string) => void;
  }): JSX.Element | null =>
    openDialog ? (
      <div data-testid="create-book-tag-dialog">
        <button data-testid="confirm-create-tag" onClick={() => onCreate("New Tag", "#ff0000")}>
          Confirm
        </button>
      </div>
    ) : null;
  CreateBookTagDialog.displayName = "CreateBookTagDialog";
  return { default: CreateBookTagDialog };
});

// Mock hooks
vi.mock("../../hooks/useBookshelves", () => ({ useBookshelves: vi.fn() }));
vi.mock("../../hooks/useBookTags", () => ({ useBookTags: vi.fn() }));

// Mock actions
vi.mock("../../reducers/BookCollectionReducer", async () => {
  const actual = await vi.importActual("../../reducers/BookCollectionReducer");
  return {
    ...actual,
    addBookshelf: vi.fn((payload: { name: string; icon_id: string }) => ({
      type: "bookCollection/addBookshelf",
      payload,
    })),
    addTag: vi.fn((payload: { name: string; color_code: string }) => ({
      type: "bookCollection/addTag",
      payload,
    })),
    setGridSize: vi.fn((payload: number) => ({ type: "bookCollection/setGridSize", payload })),
    setSortOrder: vi.fn((payload: string) => ({ type: "bookCollection/setSortOrder", payload })),
  };
});

vi.mock("../../reducers/ReadReducer", async () => {
  const actual = await vi.importActual("../../reducers/ReadReducer");
  return {
    ...actual,
    setContainerFilePath: vi.fn((payload: string) => ({
      type: "read/setContainerFilePath",
      payload,
    })),
  };
});

vi.mock("../../reducers/ViewReducer", async () => {
  const actual = await vi.importActual("../../reducers/ViewReducer");
  return {
    ...actual,
    setActiveView: vi.fn((payload: string) => ({ type: "view/setActiveView", payload })),
  };
});

describe("Bookshelf", () => {
  const user = userEvent.setup();

  const defaultPreloadedState = createBasePreloadedState();
  defaultPreloadedState.view.activeView = "bookshelf";
  defaultPreloadedState.settings = {
    ...defaultPreloadedState.settings,
    "bookshelf-sort-order": "DATE_DESC",
    "bookshelf-grid-size": 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should render main components", () => {
    renderWithProviders(<Bookshelf />, { preloadedState: defaultPreloadedState });

    expect(screen.getByTestId("menu-list")).toBeInTheDocument();
    expect(screen.getByTestId("book-grid")).toBeInTheDocument();
  });

  it("should open create bookshelf dialog and dispatch addBookshelf", async () => {
    renderWithProviders(<Bookshelf />, { preloadedState: defaultPreloadedState });

    await user.click(screen.getByTestId("add-shelf-btn"));
    expect(screen.getByTestId("create-bookshelf-dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("confirm-create-shelf"));
    expect(BookCollectionReducer.addBookshelf).toHaveBeenCalledWith({
      name: "New Shelf",
      icon_id: "icon-1",
    });
  });

  it("should open create tag dialog and dispatch addTag", async () => {
    renderWithProviders(<Bookshelf />, { preloadedState: defaultPreloadedState });

    await user.click(screen.getByTestId("add-tag-btn"));
    expect(screen.getByTestId("create-book-tag-dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("confirm-create-tag"));
    expect(BookCollectionReducer.addTag).toHaveBeenCalledWith({
      name: "New Tag",
      color_code: "#ff0000",
    });
  });

  it("should initialize settings from settingsStore on mount", async () => {
    renderWithProviders(<Bookshelf />, { preloadedState: defaultPreloadedState });

    await waitFor(() => {
      expect(BookCollectionReducer.setSortOrder).toHaveBeenCalledWith("DATE_DESC");
      expect(BookCollectionReducer.setGridSize).toHaveBeenCalledWith(2);
    });
  });

  it("should handle book selection", async () => {
    renderWithProviders(<Bookshelf />, { preloadedState: defaultPreloadedState });

    await user.click(screen.getByTestId("select-book-btn"));

    expect(ReadReducer.setContainerFilePath).toHaveBeenCalledWith("/test/book.zip");
    expect(ViewReducer.setActiveView).toHaveBeenCalledWith("reader");
  });

  it("should save pane sizes to localStorage on change", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    renderWithProviders(<Bookshelf />, { preloadedState: defaultPreloadedState });

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith(
        "bookshelf-left-pane-sizes",
        JSON.stringify([100, 900]),
      );
    });
  });

  it("should load pane sizes from localStorage on mount", () => {
    localStorage.setItem("bookshelf-left-pane-sizes", JSON.stringify([250, 750]));
    renderWithProviders(<Bookshelf />, { preloadedState: defaultPreloadedState });
  });

  it("should log error if localStorage data is malformed", () => {
    localStorage.setItem("bookshelf-left-pane-sizes", "invalid-json");
    renderWithProviders(<Bookshelf />, { preloadedState: defaultPreloadedState });
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse bookshelf-left-pane-sizes"),
    );
  });

  it("should ignore non-array or non-number array in localStorage", () => {
    localStorage.setItem("bookshelf-left-pane-sizes", JSON.stringify({ not: "an-array" }));
    renderWithProviders(<Bookshelf />, { preloadedState: defaultPreloadedState });

    localStorage.setItem("bookshelf-left-pane-sizes", JSON.stringify(["not", "numbers"]));
    renderWithProviders(<Bookshelf />, { preloadedState: defaultPreloadedState });
  });
});
