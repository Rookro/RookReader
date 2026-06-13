import { convertFileSrc } from "@tauri-apps/api/core";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CellComponentProps } from "react-window";
import { beforeEach, describe, expect, it, vi } from "vitest";
import dummy_thumbnail from "../../../assets/dummy_thumbnail.svg";
import type { Tag } from "../../../domain/tag/schema";
import { createMockBookWithState, createMockSeries, createMockTag } from "../../../test/factories";
import { useBookSelection } from "../hooks/useBookSelection";
import BookGridCell, { areEqual, type BookGridCellProps, type GridItem } from "./BookGridCell";

// Mock dependencies
vi.mock("../hooks/useBookSelection");
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn(),
}));
vi.mock("./BookContextMenu", () => ({
  default: ({
    anchor,
    onClose,
  }: {
    anchor: { mouseX: number; mouseY: number } | null;
    onClose: () => void;
  }) =>
    anchor ? (
      <button type="button" data-testid="book-context-menu" onClick={onClose}>
        Close
      </button>
    ) : null,
}));
vi.mock("./SeriesContextMenu", () => ({
  default: ({
    anchor,
    onClose,
  }: {
    anchor: { mouseX: number; mouseY: number } | null;
    onClose: () => void;
  }) =>
    anchor ? (
      <button type="button" data-testid="series-context-menu" onClick={onClose}>
        Close
      </button>
    ) : null,
}));
vi.mock("../../../components/ui/AutoScrollTypography/AutoScrollTypography", () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));

describe("BookGridCell", () => {
  const mockOnBookClick = vi.fn();
  const mockOnSeriesClick = vi.fn();
  const mockTags: Tag[] = [createMockTag({ id: 1, name: "Tag 1", color_code: "#ff0000" })];

  const defaultProps: CellComponentProps<BookGridCellProps> = {
    columnIndex: 0,
    rowIndex: 0,
    style: { top: 0, left: 0, width: 200, height: 300 },
    items: [],
    tags: mockTags,
    columnCount: 2,
    size: "medium",
    enableAutoScroll: false,
    onBookClick: mockOnBookClick,
    onSeriesClick: mockOnSeriesClick,
    allBooks: [],
    ariaAttributes: {
      "aria-colindex": 1,
      role: "gridcell",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBookSelection).mockReturnValue({
      selectedBookIds: new Set<number>(),
      toggleSelection: vi.fn(),
      setSelection: vi.fn(),
      clearSelection: vi.fn(),
      handleSelectionClick: vi.fn(),
    });
    vi.mocked(convertFileSrc).mockImplementation((path: string) => `asset://${path}`);
  });

  it("renders a BookCard when the item type is book", () => {
    const book = createMockBookWithState({ id: 101, display_name: "Test Book" });
    const items: GridItem[] = [{ type: "book", data: book }];

    render(<BookGridCell {...defaultProps} items={items} />);

    expect(screen.getByText("Test Book")).toBeInTheDocument();
  });

  it("renders a SeriesCard when the item type is series", () => {
    const series = createMockSeries({ id: 201, name: "Test Series" });
    const items: GridItem[] = [{ type: "series", data: series, books: [] }];

    render(<BookGridCell {...defaultProps} items={items} />);

    expect(screen.getByText("Test Series")).toBeInTheDocument();
  });

  it("returns null when no item is found at the index", () => {
    const { container } = render(<BookGridCell {...defaultProps} items={[]} columnIndex={5} />);
    expect(container.firstChild).toBeNull();
  });

  it("handles book click correctly", () => {
    const book = createMockBookWithState({ id: 101, display_name: "Test Book" });
    const items: GridItem[] = [{ type: "book", data: book }];

    render(<BookGridCell {...defaultProps} items={items} />);

    fireEvent.click(screen.getByText("Test Book"));
    expect(mockOnBookClick).toHaveBeenCalledWith(book, expect.anything());
  });

  it("handles series click correctly", () => {
    const series = createMockSeries({ id: 201, name: "Test Series" });
    const items: GridItem[] = [{ type: "series", data: series, books: [] }];

    render(<BookGridCell {...defaultProps} items={items} />);

    fireEvent.click(screen.getByText("Test Series"));
    expect(mockOnSeriesClick).toHaveBeenCalledWith(201);
  });

  it("renders book tags correctly", () => {
    const book = createMockBookWithState({
      id: 101,
      display_name: "Test Book",
      tag_ids: [1],
    });
    const items: GridItem[] = [{ type: "book", data: book }];

    render(<BookGridCell {...defaultProps} items={items} />);

    expect(screen.getByText("Tag 1")).toBeInTheDocument();
  });

  it("displays selection indicator when book is selected", () => {
    const book = createMockBookWithState({ id: 101, display_name: "Test Book" });
    const items: GridItem[] = [{ type: "book", data: book }];

    vi.mocked(useBookSelection).mockReturnValue({
      selectedBookIds: new Set<number>([101]),
      toggleSelection: vi.fn(),
      setSelection: vi.fn(),
      clearSelection: vi.fn(),
      handleSelectionClick: vi.fn(),
    });

    render(<BookGridCell {...defaultProps} items={items} />);

    expect(screen.getByTestId("CheckCircleIcon")).toBeInTheDocument();
  });

  it("displays reading indicator when index matches readingBookIndex", () => {
    const book = createMockBookWithState({ id: 101, display_name: "Test Book" });
    const items: GridItem[] = [{ type: "book", data: book }];

    render(<BookGridCell {...defaultProps} items={items} readingBookIndex={0} />);

    expect(screen.getByTestId("MenuBookIcon")).toBeInTheDocument();
  });

  it("shows progress bar based on last_read_page_index", () => {
    const book = createMockBookWithState({
      id: 101,
      display_name: "Test Book",
      total_pages: 100,
      last_read_page_index: 49, // 50th page, so 50%
    });
    const items: GridItem[] = [{ type: "book", data: book }];

    render(<BookGridCell {...defaultProps} items={items} />);

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "50");
  });

  it("shows progress bar as 0 when total_pages is 0", () => {
    const book = createMockBookWithState({
      id: 101,
      display_name: "Test Book",
      total_pages: 0,
      last_read_page_index: 49,
    });
    const items: GridItem[] = [{ type: "book", data: book }];

    render(<BookGridCell {...defaultProps} items={items} />);

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "0");
  });

  it("shows progress bar as 0 when last_read_page_index is undefined", () => {
    const book = createMockBookWithState({
      id: 101,
      display_name: "Test Book",
      total_pages: 100,
      last_read_page_index: undefined,
    });
    const items: GridItem[] = [{ type: "book", data: book }];

    render(<BookGridCell {...defaultProps} items={items} />);

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "0");
  });

  it("shows series book count badge", () => {
    const series = createMockSeries({ id: 201, name: "Test Series" });
    const books = [createMockBookWithState({ id: 1 }), createMockBookWithState({ id: 2 })];
    const items: GridItem[] = [{ type: "series", data: series, books }];

    render(<BookGridCell {...defaultProps} items={items} />);

    expect(screen.getByText("2")).toBeInTheDocument(); // Badge content
  });

  it("opens book context menu on right click and can be closed", () => {
    const book = createMockBookWithState({ id: 101, display_name: "Test Book" });
    const items: GridItem[] = [{ type: "book", data: book }];

    render(<BookGridCell {...defaultProps} items={items} />);

    fireEvent.contextMenu(screen.getByText("Test Book"));
    const menu = screen.getByTestId("book-context-menu");
    expect(menu).toBeInTheDocument();

    // Click the mock menu to trigger onClose
    fireEvent.click(menu);
    expect(menu).not.toBeInTheDocument();
  });

  it("opens series context menu on right click and can be closed", () => {
    const series = createMockSeries({ id: 201, name: "Test Series" });
    const items: GridItem[] = [{ type: "series", data: series, books: [] }];

    render(<BookGridCell {...defaultProps} items={items} />);

    fireEvent.contextMenu(screen.getByText("Test Series"));
    const menu = screen.getByTestId("series-context-menu");
    expect(menu).toBeInTheDocument();

    // Click the mock menu to trigger onClose
    fireEvent.click(menu);
    expect(menu).not.toBeInTheDocument();
  });

  it("uses dummy thumbnail when book thumbnail_path is missing", () => {
    const book = createMockBookWithState({
      id: 101,
      display_name: "Test Book",
      thumbnail_path: "",
    });
    const items: GridItem[] = [{ type: "book", data: book }];

    render(<BookGridCell {...defaultProps} items={items} />);

    const img = screen.getByAltText("Test Book");
    expect(img).toHaveAttribute("src", dummy_thumbnail);
  });

  it("switches to dummy thumbnail on image load error in BookCard", () => {
    const book = createMockBookWithState({
      id: 101,
      display_name: "Test Book",
      thumbnail_path: "valid.jpg",
    });
    const items: GridItem[] = [{ type: "book", data: book }];

    render(<BookGridCell {...defaultProps} items={items} />);

    const img = screen.getByAltText("Test Book");
    expect(img).toHaveAttribute("src", "asset://valid.jpg");

    fireEvent.error(img);

    expect(img).toHaveAttribute("src", dummy_thumbnail);
  });

  it("switches to dummy thumbnail on image load error in SeriesCard", () => {
    const series = createMockSeries({ id: 201, name: "Test Series" });
    const book = createMockBookWithState({
      id: 101,
      display_name: "Book 1",
      thumbnail_path: "valid.jpg",
    });
    const items: GridItem[] = [{ type: "series", data: series, books: [book] }];

    render(<BookGridCell {...defaultProps} items={items} />);

    const img = screen.getByAltText("Book 1");
    expect(img).toHaveAttribute("src", "asset://valid.jpg");

    fireEvent.error(img);

    expect(img).toHaveAttribute("src", dummy_thumbnail);
  });

  describe("areEqual", () => {
    const item1: GridItem = { type: "book", data: createMockBookWithState({ id: 1 }) };
    const item2: GridItem = { type: "book", data: createMockBookWithState({ id: 2 }) };

    const props: CellComponentProps<BookGridCellProps> = {
      ...defaultProps,
      items: [item1],
    };

    it("returns true if props are identical", () => {
      expect(areEqual(props, props)).toBe(true);
    });

    it("returns false if columnIndex changes", () => {
      expect(areEqual(props, { ...props, columnIndex: 1 })).toBe(false);
    });

    it("returns false if rowIndex changes", () => {
      expect(areEqual(props, { ...props, rowIndex: 1 })).toBe(false);
    });

    it("returns false if columnCount changes", () => {
      expect(areEqual(props, { ...props, columnCount: 3 })).toBe(false);
    });

    it("returns false if size changes", () => {
      expect(areEqual(props, { ...props, size: "small" })).toBe(false);
    });

    it("returns false if tags change", () => {
      expect(areEqual(props, { ...props, tags: [] })).toBe(false);
    });

    it("returns false if enableAutoScroll changes", () => {
      expect(areEqual(props, { ...props, enableAutoScroll: true })).toBe(false);
    });

    it("returns false if readingBookIndex changes", () => {
      expect(areEqual(props, { ...props, readingBookIndex: 0 })).toBe(false);
    });

    it("returns false if the item at the current index changes", () => {
      const otherProps = { ...props, items: [item2] };
      expect(areEqual(props, otherProps)).toBe(false);
    });

    it("returns false if allBooks changes", () => {
      expect(areEqual(props, { ...props, allBooks: [createMockBookWithState({ id: 3 })] })).toBe(
        false,
      );
    });

    it("returns false if style.top changes", () => {
      const otherProps = { ...props, style: { ...props.style, top: 10 } };
      expect(areEqual(props, otherProps)).toBe(false);
    });

    it("returns false if style.left changes", () => {
      const otherProps = { ...props, style: { ...props.style, left: 10 } };
      expect(areEqual(props, otherProps)).toBe(false);
    });

    it("returns false if style.width changes", () => {
      const otherProps = { ...props, style: { ...props.style, width: 300 } };
      expect(areEqual(props, otherProps)).toBe(false);
    });

    it("returns false if style.height changes", () => {
      const otherProps = { ...props, style: { ...props.style, height: 400 } };
      expect(areEqual(props, otherProps)).toBe(false);
    });

    it("returns true if style changes but values are the same", () => {
      const otherProps = { ...props, style: { ...props.style } };
      // By default object comparison is false, but values are the same
      // areEqual checks values if style object reference is different
      expect(areEqual(props, otherProps)).toBe(true);
    });
  });
});
