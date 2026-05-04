import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as SeriesCommand from "../../../bindings/SeriesCommand";
import { renderWithProviders } from "../../../test/utils";
import type { Series } from "../../../types/DatabaseModels";
import { BookshelfActionsContext } from "./BookshelfActionsContext";
import SeriesContextMenu, { type SeriesContextMenuProps } from "./SeriesContextMenu";

describe("SeriesContextMenu", () => {
  const user = userEvent.setup();
  const mockSeries: Series = { id: 1, name: "Test Series", created_at: "2026-03-01T15:30:00" };

  const mockActions = {
    openDialog: vi.fn(),
    refreshBookshelf: vi.fn(),
    refreshSeries: vi.fn(),
  };

  const defaultProps: SeriesContextMenuProps = {
    series: mockSeries,
    anchor: { mouseX: 100, mouseY: 100 },
    onClose: vi.fn(),
  };

  const renderSeriesContextMenu = (props = defaultProps) => {
    return renderWithProviders(
      <BookshelfActionsContext.Provider value={mockActions}>
        <SeriesContextMenu {...props} />
      </BookshelfActionsContext.Provider>,
    );
  };

  it("should render menu items when anchor is provided", () => {
    renderSeriesContextMenu();

    expect(screen.getByText(/Ungroup Series/i)).toBeInTheDocument();
  });

  it("should call deleteSeries, refreshSeries and onClose when ungroup is clicked", async () => {
    vi.mocked(SeriesCommand.deleteSeries).mockResolvedValue();
    renderSeriesContextMenu();

    await user.click(screen.getByText(/Ungroup Series/i));

    expect(SeriesCommand.deleteSeries).toHaveBeenCalledWith(mockSeries.id);
    expect(mockActions.refreshSeries).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should not render menu when anchor is null", () => {
    renderSeriesContextMenu({ ...defaultProps, anchor: null });
    expect(screen.queryByText(/Ungroup Series/i)).not.toBeInTheDocument();
  });

  it("should handle deleteSeries error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(SeriesCommand.deleteSeries).mockRejectedValue(new Error("Delete failed"));

    renderSeriesContextMenu();

    await user.click(screen.getByText(/Ungroup Series/i));

    expect(SeriesCommand.deleteSeries).toHaveBeenCalledWith(mockSeries.id);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to remove series"));

    consoleSpy.mockRestore();
  });
});
