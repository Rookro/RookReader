import React, { type ComponentType, type JSX, type ReactNode } from "react";
import { vi } from "vitest";
import type { Book } from "../../types/DatabaseModels";

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
      {Array.from({ length: rowCount }, (_, index) => index).map((value, index) => (
        <div key={value} data-testid={`row-wrapper-${index}`}>
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
    cellProps: { books?: Book[]; items?: unknown[]; [key: string]: unknown };
  }) => {
    const list = cellProps.items ?? cellProps.books ?? [];
    return (
      <div data-testid="virtualized-grid">
        {list.map((item: any, index: number) => {
          const id = item.type === "series" ? item.data.id : (item.data?.id ?? item.id);
          return (
            <button
              type="button"
              key={id}
              data-testid={`book-cell-${index}`}
              onContextMenu={(e: React.MouseEvent) =>
                (cellProps.onBookContextMenu as (item: unknown, e: React.MouseEvent) => void)?.(
                  item.type === "book" ? item.data : item,
                  e,
                )
              }
            >
              <Cell columnIndex={index} rowIndex={0} style={{}} {...cellProps} index={index} />
            </button>
          );
        })}
      </div>
    );
  },
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
