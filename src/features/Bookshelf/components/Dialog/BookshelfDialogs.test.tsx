import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState, createMockSeries } from "../../../../test/factories";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import BookshelfDialogs, { type BookshelfDialogsProps } from "./BookshelfDialogs";

vi.mock("./SetBookshelvesDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="set-bookshelves" /> : null),
}));
vi.mock("./SetBookTagsDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="set-tags" /> : null),
}));
vi.mock("./SetSeriesDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="set-series" /> : null),
}));
vi.mock("./BookDeleteDialog", () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <button type="button" data-testid="delete-books" onClick={onClose}>
        close
      </button>
    ) : null,
}));
vi.mock("./EditSeriesOrderDialog", () => ({
  default: ({
    open,
    seriesId,
    onClose,
  }: {
    open: boolean;
    seriesId: number | null;
    onClose: () => void;
  }) =>
    open ? (
      <button type="button" data-testid="edit-series-order" onClick={onClose}>
        {String(seriesId)}
      </button>
    ) : null,
}));

describe("BookshelfDialogs", () => {
  const vol1 = createMockBookWithState({
    id: 1,
    display_name: "Vol 1",
    series_id: 10,
    series_order: 1,
  });
  const vol2 = createMockBookWithState({
    id: 2,
    display_name: "Vol 2",
    series_id: 10,
    series_order: 2,
  });
  const other = createMockBookWithState({ id: 3, display_name: "Other", series_id: 11 });

  const defaultProps: BookshelfDialogsProps = {
    dialogType: null,
    dialogBooks: [],
    dialogBookIds: [],
    editSeriesOrderSeriesId: null,
    onBookDialogClose: vi.fn(),
    onEditSeriesOrderClose: vi.fn(),
  };

  const renderDialogs = (props: Partial<BookshelfDialogsProps>) => {
    const preloadedState = createBasePreloadedState();
    preloadedState.bookCollection.books = [vol2, other, vol1];
    preloadedState.series.series = [createMockSeries({ id: 10 }), createMockSeries({ id: 11 })];
    return renderWithProviders(<BookshelfDialogs {...defaultProps} {...props} />, {
      preloadedState,
    });
  };

  it("renders no dialog when none is open", () => {
    renderDialogs({});
    for (const id of [
      "set-bookshelves",
      "set-tags",
      "set-series",
      "delete-books",
      "edit-series-order",
    ]) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument();
    }
  });

  it.each(["set-bookshelves", "set-tags", "set-series", "delete-books"] as const)(
    "opens only the %s dialog",
    (type) => {
      renderDialogs({ dialogType: type, dialogBooks: [vol1], dialogBookIds: [1] });
      expect(screen.getByTestId(type)).toBeInTheDocument();
      expect(screen.queryByTestId("edit-series-order")).not.toBeInTheDocument();
    },
  );

  it("closes a book dialog through onBookDialogClose", () => {
    const onBookDialogClose = vi.fn();
    renderDialogs({ dialogType: "delete-books", dialogBooks: [vol1], onBookDialogClose });

    screen.getByTestId("delete-books").click();
    expect(onBookDialogClose).toHaveBeenCalled();
  });

  // The dialog loads the whole series itself; it only needs to know which one
  it("gives the edit-order dialog the series to edit", () => {
    const onEditSeriesOrderClose = vi.fn();
    renderDialogs({
      dialogType: "edit-series-order",
      editSeriesOrderSeriesId: 10,
      onEditSeriesOrderClose,
    });

    const dialog = screen.getByTestId("edit-series-order");
    expect(dialog.textContent).toBe("10");

    dialog.click();
    expect(onEditSeriesOrderClose).toHaveBeenCalled();
  });
});
