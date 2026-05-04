import { memo } from "react";
import type { CellComponentProps } from "react-window";
import type { BookWithState, Series, Tag } from "../../../types/DatabaseModels";
import BookCard from "./BookCard";
import SeriesCard from "./SeriesCard";

/** Represents an item that can be displayed in the book grid. */
export type GridItem =
  | { type: "book"; data: BookWithState }
  | { type: "series"; data: Series; books: BookWithState[] };

/** Props for the BookGridCell component. */
export interface BookGridCellProps {
  /** The list of grid items to display. */
  items: GridItem[];
  /** The list of tags for books. */
  tags: Tag[];
  /** The size of the card. */
  size: "small" | "medium";
  /** The number of columns in the grid. */
  columnCount: number;
  /** Whether to enable automatic horizontal scrolling for overflowing text. */
  enableAutoScroll: boolean;
  /** Callback for when a book is selected/clicked. */
  onBookClick?: (book: BookWithState, event: React.MouseEvent) => void;
  /** Callback for when a series is clicked. */
  onSeriesClick: (seriesId: number) => void;
}

/**
 * A component to render a single cell in the BookGrid.
 * It determines whether to render a SeriesCard or a BookCard.
 */
function BookGridCellInner({
  items,
  tags,
  columnCount,
  enableAutoScroll,
  onBookClick,
  onSeriesClick,
  columnIndex,
  rowIndex,
  size,
  style,
}: CellComponentProps<BookGridCellProps>) {
  const index = rowIndex * columnCount + columnIndex;
  const item = items[index];

  if (!item) {
    return null;
  }

  if (item.type === "series") {
    return (
      <SeriesCard
        series={item.data}
        books={item.books}
        enableAutoScroll={enableAutoScroll}
        onClick={onSeriesClick}
        style={style}
      />
    );
  }

  return (
    <BookCard
      book={item.data}
      tags={tags}
      size={size}
      enableAutoScroll={enableAutoScroll}
      onBookClick={onBookClick}
      style={style}
    />
  );
}

/** Comparison function for memoization of BookGridCell. */
function areEqual(
  prevProps: Readonly<CellComponentProps<BookGridCellProps>>,
  nextProps: Readonly<CellComponentProps<BookGridCellProps>>,
) {
  if (
    prevProps.columnIndex !== nextProps.columnIndex ||
    prevProps.rowIndex !== nextProps.rowIndex ||
    prevProps.columnCount !== nextProps.columnCount ||
    prevProps.size !== nextProps.size ||
    prevProps.tags !== nextProps.tags ||
    prevProps.enableAutoScroll !== nextProps.enableAutoScroll
  ) {
    return false;
  }

  const index = prevProps.rowIndex * prevProps.columnCount + prevProps.columnIndex;
  const prevItem = prevProps.items[index];
  const nextItem = nextProps.items[index];

  if (prevItem !== nextItem) {
    return false;
  }

  if (prevProps.style !== nextProps.style) {
    if (
      prevProps.style.top !== nextProps.style.top ||
      prevProps.style.left !== nextProps.style.left ||
      prevProps.style.width !== nextProps.style.width ||
      prevProps.style.height !== nextProps.style.height
    ) {
      return false;
    }
  }

  return true;
}

const MemoizedBookGridCell = memo(BookGridCellInner, areEqual);

/**
 * The BookGridCell component that wraps the memoized inner component.
 */
export default function BookGridCell(props: CellComponentProps<BookGridCellProps>) {
  return <MemoizedBookGridCell {...props} />;
}
