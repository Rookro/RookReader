import { vi } from "vitest";
import React, { ReactNode, JSX, ComponentType } from "react";

/** Mock for scrollToRow function */
export const mockScrollToRow = vi.fn();

// Mock react-window
vi.mock("react-window", () => ({
  List: ({
    rowComponent: Row,
    rowProps,
    rowCount,
  }: {
    rowComponent: ComponentType<Record<string, unknown>>;
    rowProps: Record<string, unknown>;
    rowCount: number;
  }) => (
    <div data-testid="virtualized-list">
      {Array.from({ length: rowCount }).map((_, index) => (
        <div key={index} data-testid={`row-wrapper-${index}`}>
          <Row index={index} style={{}} {...rowProps} isScrolling={false} />
        </div>
      ))}
    </div>
  ),
  Grid: ({
    cellComponent: Cell,
    cellProps,
  }: {
    cellComponent: ComponentType<Record<string, unknown>>;
    cellProps: { books: unknown[]; [key: string]: unknown };
  }) => (
    <div data-testid="virtualized-grid">
      {(cellProps?.books ?? []).map((_book: unknown, index: number) => {
        return (
          <div
            key={index}
            data-testid={`book-cell-${index}`}
            onContextMenu={(e: React.MouseEvent) =>
              (
                cellProps.onBookContextMenu as (
                  book: unknown,
                  e: React.MouseEvent,
                ) => void | undefined
              )?.(cellProps.books[index], e)
            }
          >
            <Cell columnIndex={index} rowIndex={0} style={{}} {...cellProps} index={index} />
          </div>
        );
      })}
    </div>
  ),
  useListCallbackRef: vi.fn(() => [{ scrollToRow: mockScrollToRow }, vi.fn()]),
}));

// Mock allotment
vi.mock("allotment", () => {
  const Allotment = ({
    children,
    onChange,
    defaultSizes,
  }: {
    children: ReactNode;
    onChange?: (sizes: number[]) => void;
    defaultSizes?: number[];
  }): JSX.Element => {
    React.useEffect(() => {
      if (onChange && defaultSizes) {
        onChange(defaultSizes);
      } else if (onChange) {
        // Fallback for tests that don't provide defaultSizes but expect a change event
        onChange([100, 900]);
      }
    }, [onChange, defaultSizes]);

    return <div data-testid="allotment">{children}</div>;
  };
  const Pane = ({ children }: { children: ReactNode }): JSX.Element => (
    <div data-testid="allotment-pane">{children}</div>
  );
  Pane.displayName = "Pane";
  return {
    Allotment: Object.assign(Allotment, { Pane, displayName: "Allotment" }),
  };
});
