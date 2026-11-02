import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import { setActiveView } from "../../MainView/slice";
import { removeCollection } from "../slice";
import { removeTag, setSelectedTag } from "../tagSlice";
import MenuList from "./MenuList";

vi.mock("../slice", async () => {
  const actual = await vi.importActual("../slice");
  return {
    ...actual,
    removeCollection: vi.fn((id) => ({ type: "removeCollection", payload: id })),
  };
});

vi.mock("../tagSlice", async () => {
  const actual = await vi.importActual("../tagSlice");
  return {
    ...actual,
    setSelectedTag: vi.fn((id) => ({ type: "setSelectedTag", payload: id })),
    removeTag: vi.fn((id) => ({ type: "removeTag", payload: id })),
  };
});

vi.mock("../../MainView/slice", async () => {
  const actual = await vi.importActual("../../MainView/slice");
  return {
    ...actual,
    setActiveView: vi.fn((view) => ({ type: "setActiveView", payload: view })),
  };
});

describe("MenuList", () => {
  const user = userEvent.setup();

  const mockCollections = [{ id: 1, name: "Bookshelf 1", icon_id: "folder", created_at: "" }];
  const mockTags = [{ id: 10, name: "Tag 1", color_code: "#ff0000" }];

  const preloadedState = createBasePreloadedState();
  preloadedState.collection.collections = mockCollections;
  preloadedState.tag.tags = mockTags;

  const defaultProps = {
    onClickAddCollection: vi.fn(),
    onClickAddBookTag: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that "All Books", collection list, and tag list are displayed correctly
  it("should render all books, collections and tags", () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    expect(screen.getByText("All Books")).toBeInTheDocument();
    expect(screen.getByText("Bookshelf 1")).toBeInTheDocument();
    expect(screen.getByText("Tag 1")).toBeInTheDocument();
  });

  // Verify that clicking a collection selects it
  it("should select the collection when it is clicked", async () => {
    const { store } = renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    await user.click(screen.getByText("Bookshelf 1"));
    expect(store.getState().collection.selectedId).toBe(1);
  });

  it("should show fallback icon for unknown icon_id", () => {
    const stateWithUnknownIcon = createBasePreloadedState();
    stateWithUnknownIcon.collection.collections = [
      { id: 2, name: "Unknown Icon", icon_id: "non-existent", created_at: "" },
    ];
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState: stateWithUnknownIcon });
    expect(screen.getByTestId("FolderOutlinedIcon")).toBeInTheDocument();
  });

  // Verify that setSelectedTag action is called correctly when a tag is clicked
  it("should call setSelectedTag when a tag is clicked", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    await user.click(screen.getByText("Tag 1"));
    expect(setSelectedTag).toHaveBeenCalledWith(10);
  });

  it("should deselect tag when the same tag is clicked", async () => {
    const stateWithTagSelected = createBasePreloadedState();
    stateWithTagSelected.collection.collections = mockCollections;
    stateWithTagSelected.tag.tags = mockTags;
    stateWithTagSelected.tag.selectedId = 10;

    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState: stateWithTagSelected });
    await user.click(screen.getByText("Tag 1"));
    expect(setSelectedTag).toHaveBeenCalledWith(null);
  });

  // Verify that setActiveView action is called correctly when return to reader is clicked
  it("should call setActiveView when return to reader is clicked", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    const backButton = screen.getByRole("button", { name: "book-reader" });
    await user.click(backButton);
    expect(setActiveView).toHaveBeenCalledWith("reader");
  });

  // Verify that context menu is shown for collection and delete operation is handled correctly
  it("should show context menu and handle delete for collection", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    const collectionItem = screen.getByText("Bookshelf 1");

    // Right click to show context menu
    await user.pointer({ keys: "[MouseRight]", target: collectionItem });

    const deleteButton = screen.getByText("Delete");
    expect(deleteButton).toBeInTheDocument();

    await user.click(deleteButton);
    expect(screen.getByText("Delete this collection?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(removeCollection).toHaveBeenCalledWith(1);
  });

  // Verify that context menu is shown for tag and delete operation is handled correctly
  it("should show context menu and handle delete for tag", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    const tagItem = screen.getByText("Tag 1");

    await user.pointer({ keys: "[MouseRight]", target: tagItem });

    await user.click(screen.getByText("Delete"));
    expect(screen.getByText("Delete this tag?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(removeTag).toHaveBeenCalledWith(10);
  });

  it("should not delete a collection until the confirmation is accepted", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Bookshelf 1") });
    await user.click(screen.getByText("Delete"));

    expect(removeCollection).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(removeCollection).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText("Delete this collection?")).not.toBeInTheDocument(),
    );
  });

  it("should close context menu on backdrop click", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    const collectionItem = screen.getByText("Bookshelf 1");

    await user.pointer({ keys: "[MouseRight]", target: collectionItem });
    expect(screen.getByText("Delete")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    });
  });

  it("should handle context menu on the context menu itself", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    const collectionItem = screen.getByText("Bookshelf 1");

    await user.pointer({ keys: "[MouseRight]", target: collectionItem });
    const menu = screen.getByRole("menu");

    // Right click on the menu should close it
    await user.pointer({ keys: "[MouseRight]", target: menu });

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("should call onClickAddCollection when add button is clicked", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    const addButtons = screen.getAllByTestId("AddIcon");
    await user.click(addButtons[0]);
    expect(defaultProps.onClickAddCollection).toHaveBeenCalled();
  });

  it("should call onClickAddBookTag when add button is clicked", async () => {
    renderWithProviders(<MenuList {...defaultProps} />, { preloadedState });
    const addButtons = screen.getAllByTestId("AddIcon");
    await user.click(addButtons[1]);
    expect(defaultProps.onClickAddBookTag).toHaveBeenCalled();
  });
});
