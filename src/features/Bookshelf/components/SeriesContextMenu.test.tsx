import { error } from "@tauri-apps/plugin-log";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as SeriesCommand from "../../../bindings/SeriesCommands";
import type { Series } from "../../../domain/series/schema";
import { renderWithProviders } from "../../../test/utils";
import { BookshelfActionsContext } from "./BookshelfActionsContext";
import SeriesContextMenu, { type SeriesContextMenuProps } from "./SeriesContextMenu";

describe("SeriesContextMenu", () => {
  const user = userEvent.setup();
  const mockSeries: Series = { id: 1, name: "Test Series", created_at: "2026-03-01T15:30:00" };

  const mockActions = {
    openDialog: vi.fn(),
  };

  const defaultProps: SeriesContextMenuProps = {
    series: mockSeries,
    anchor: { mouseX: 100, mouseY: 100 },
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(screen.getByText(/Edit Series Order/i)).toBeInTheDocument();
  });

  it("should call setEditSeriesOrderDialogState and onClose when Edit Order is clicked", async () => {
    const { store } = renderSeriesContextMenu();

    await user.click(screen.getByText(/Edit Series Order/i));

    const state = store.getState().series;
    expect(state.isEditSeriesOrderDialogOpen).toBe(true);
    expect(state.editSeriesOrderTargetId).toBe(mockSeries.id);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call deleteSeries and onClose once the ungroup is confirmed", async () => {
    vi.mocked(SeriesCommand.deleteSeries).mockResolvedValue();
    renderSeriesContextMenu();

    await user.click(screen.getByText(/Ungroup Series/i));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(SeriesCommand.deleteSeries).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Ungroup series/i }));

    expect(SeriesCommand.deleteSeries).toHaveBeenCalledWith(mockSeries.id);
  });

  it("should not ungroup when the confirmation is cancelled", async () => {
    renderSeriesContextMenu();

    await user.click(screen.getByText(/Ungroup Series/i));
    expect(screen.getByText("Ungroup this series?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(SeriesCommand.deleteSeries).not.toHaveBeenCalled();
  });

  it("should not render menu when anchor is null", () => {
    renderSeriesContextMenu({ ...defaultProps, anchor: null });
    expect(screen.queryByText(/Ungroup Series/i)).not.toBeInTheDocument();
  });

  it("should handle deleteSeries error", async () => {
    vi.mocked(SeriesCommand.deleteSeries).mockRejectedValue(new Error("Delete failed"));

    renderSeriesContextMenu();

    await user.click(screen.getByText(/Ungroup Series/i));
    await user.click(screen.getByRole("button", { name: /Ungroup series/i }));

    expect(SeriesCommand.deleteSeries).toHaveBeenCalledWith(mockSeries.id);
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to remove series")),
    );
  });

  it("should prevent default and stop propagation on context menu event", async () => {
    renderSeriesContextMenu();

    const menu = screen.getByRole("menu");
    // Create event manually to spy on it
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    vi.spyOn(event, "preventDefault");
    vi.spyOn(event, "stopPropagation");

    fireEvent(menu, event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
