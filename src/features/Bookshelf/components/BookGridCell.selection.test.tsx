import { fireEvent, render, screen } from "@testing-library/react";
import { useCallback } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BookWithState } from "../../../domain/book/schema";
import type { Tag } from "../../../domain/tag/schema";
import { createMockBookWithState } from "../../../test/factories";
import { useBookSelection } from "../hooks/useBookSelection";
import BookGridCell from "./BookGridCell";
import { BookSelectionProvider } from "./BookSelectionContext";

vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: (path: string) => path }));
vi.mock("./BookContextMenu", () => ({ default: () => null }));
vi.mock("../../../components/ui/AutoScrollTypography/AutoScrollTypography", () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));

const bookA = createMockBookWithState({ id: 1, display_name: "A" });
const bookB = createMockBookWithState({ id: 2, display_name: "B" });
const items = [
  { type: "book" as const, data: bookA },
  { type: "book" as const, data: bookB },
];
const TAGS: Tag[] = [];
const style = { top: 0, left: 0, width: 100, height: 100 };

/** Two real cells wired to the real selection, as BookGrid wires them. */
function TwoCells({ onBookSelect }: { onBookSelect: () => void }) {
  const { handleSelectionClick } = useBookSelection();
  const onBookClick = useCallback(
    (book: BookWithState, e: React.MouseEvent | React.KeyboardEvent) =>
      handleSelectionClick(book, e as React.MouseEvent, [bookA, bookB], onBookSelect),
    [handleSelectionClick, onBookSelect],
  );
  const common = {
    items,
    tags: TAGS,
    size: "medium" as const,
    columnCount: 2,
    enableAutoScroll: false,
    onBookClick,
    onSeriesClick: () => {},
    horizontalOffset: 0,
    focusedIndex: -1,
    readingBookIndex: -1,
    style,
    rowIndex: 0,
    ariaAttributes: { "aria-colindex": 1, role: "gridcell" as const },
  };
  return (
    <>
      <BookGridCell {...common} columnIndex={0} />
      <BookGridCell {...common} columnIndex={1} />
    </>
  );
}

describe("BookGridCell selection", () => {
  // A cell memoised on a stale handler would see no selection and open the book
  it("plain click with an active selection selects instead of opening", () => {
    const onBookSelect = vi.fn();
    render(
      <BookSelectionProvider>
        <TwoCells onBookSelect={onBookSelect} />
      </BookSelectionProvider>,
    );
    const cards = screen.getAllByRole("button");

    fireEvent.click(cards[0], { ctrlKey: true });
    fireEvent.click(cards[1]);

    expect(onBookSelect).not.toHaveBeenCalled();
  });
});
