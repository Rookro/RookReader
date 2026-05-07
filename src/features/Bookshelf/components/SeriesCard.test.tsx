import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState } from "../../../test/factories";
import { renderWithProviders } from "../../../test/utils";
import { BookshelfActionsContext } from "./BookshelfActionsContext";
import SeriesCard from "./SeriesCard";

describe("SeriesCard", () => {
  const user = userEvent.setup();

  const mockSeries = {
    id: 1,
    name: "Test Series",
    created_at: "2026-03-01T15:30:00",
  };

  const mockBooks = [
    createMockBookWithState({ id: 101, display_name: "Book 1", series_id: 1, series_order: 1 }),
    createMockBookWithState({ id: 102, display_name: "Book 2", series_id: 1, series_order: 2 }),
  ];

  const mockActions = {
    openDialog: vi.fn(),
    refreshBookshelf: vi.fn(),
    refreshSeries: vi.fn(),
  };

  const defaultProps = {
    series: mockSeries,
    books: mockBooks,
    onClick: vi.fn(),
  };

  const renderSeriesCard = (props = defaultProps) => {
    return renderWithProviders(
      <BookshelfActionsContext.Provider value={mockActions}>
        <SeriesCard {...props} />
      </BookshelfActionsContext.Provider>,
    );
  };

  it("should render series name and volume count badge", () => {
    renderSeriesCard();

    expect(screen.getByText("Test Series")).toBeInTheDocument();
    // Badge content "2" should be present
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("should call onClick when clicked", async () => {
    const onClick = vi.fn();
    renderSeriesCard({ ...defaultProps, onClick });

    const actionArea = screen.getByRole("button");
    await user.click(actionArea);

    expect(onClick).toHaveBeenCalledWith(1);
  });

  it("should render multiple book thumbnails in a stack", () => {
    const { container } = renderSeriesCard();

    // There should be two CardMedia images (for the two mock books)
    const images = container.querySelectorAll("img");
    expect(images.length).toBe(2);
  });
});
