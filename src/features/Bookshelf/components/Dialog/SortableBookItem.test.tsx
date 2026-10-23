import { useSortable } from "@dnd-kit/sortable";
import { createTheme } from "@mui/material";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState } from "../../../../test/factories";
import { renderWithProviders } from "../../../../test/utils";
import SortableBookItem from "./SortableBookItem";

vi.mock("@dnd-kit/sortable", () => ({ useSortable: vi.fn() }));

describe("SortableBookItem", () => {
  const sortable = (isDragging: boolean) =>
    ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging,
    }) as unknown as ReturnType<typeof useSortable>;

  // A theme token in an inline style is not a colour, so the highlight never showed
  it("highlights the volume being dragged", () => {
    vi.mocked(useSortable).mockReturnValue(sortable(true));
    renderWithProviders(
      <SortableBookItem book={createMockBookWithState({ display_name: "Vol 1" })} index={0} />,
    );

    expect(screen.getByRole("listitem")).toHaveStyle({
      backgroundColor: createTheme().palette.action.hover,
    });
  });
});
