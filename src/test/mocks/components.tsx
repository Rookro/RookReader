import React, { type ComponentType, type JSX, type ReactNode } from "react";
import { vi } from "vitest";
import type { Book } from "../../domain/book/schema";

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
    cellProps: {
      books?: Book[];
      items?: { type: string; data: { id: number } }[];
      [key: string]: unknown;
    };
  }) => {
    const list = cellProps.items ?? cellProps.books ?? [];
    return (
      <div data-testid="virtualized-grid">
        {list.map((item, index: number) => {
          const id =
            typeof item === "object" && item !== null && "type" in item && item.type === "series"
              ? (item as { data: { id: number } }).data.id
              : ((item as { data?: { id: number }; id?: number }).data?.id ??
                (item as { id: number }).id);
          return (
            <div key={id} data-testid={`book-cell-${index}`}>
              <Cell columnIndex={index} rowIndex={0} style={{}} {...cellProps} index={index} />
            </div>
          );
        })}
      </div>
    );
  },
  useListCallbackRef: vi.fn(() => [{ scrollToRow: mockScrollToRow }, vi.fn()]),
  useGridCallbackRef: vi.fn(() => [{ scrollToCell: vi.fn() }, vi.fn()]),
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
