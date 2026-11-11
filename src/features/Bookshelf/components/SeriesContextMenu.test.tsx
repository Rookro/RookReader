import { error } from "@tauri-apps/plugin-log";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../bindings/api";
import type { Series } from "../../../domain/entities";
import { renderWithProviders } from "../../../test/utils";
import { ErrorCode } from "../../../types/Error";
import { BookshelfActionsContext } from "./BookshelfActionsContext";
import SeriesContextMenu, { type SeriesContextMenuProps } from "./SeriesContextMenu";

describe("SeriesContextMenu", () => {
  const user = userEvent.setup();
  const mockSeries: Series = { id: 1, name: "Test Series", createdAt: "2026-03-01T15:30:00Z" };

  const mockActions = {
    openDialog: vi.fn(),
    openEditSeriesOrderDialog: vi.fn(),
    getSelectedBooks: vi.fn(() => []),
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

  it("should open the edit-order dialog for this series and close when Edit Order is clicked", async () => {
    renderSeriesContextMenu();

    await user.click(screen.getByText(/Edit Series Order/i));

    expect(mockActions.openEditSeriesOrderDialog).toHaveBeenCalledWith(mockSeries.id);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call deleteSeries and onClose once the ungroup is confirmed", async () => {
    vi.mocked(api.deleteSeries).mockResolvedValue(null);
    renderSeriesContextMenu();

    await user.click(screen.getByText(/Ungroup Series/i));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(api.deleteSeries).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Ungroup series/i }));

    expect(api.deleteSeries).toHaveBeenCalledWith(mockSeries.id);
  });

  it("should not ungroup when the confirmation is cancelled", async () => {
    renderSeriesContextMenu();

    await user.click(screen.getByText(/Ungroup Series/i));
    expect(screen.getByText("Ungroup this series?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.deleteSeries).not.toHaveBeenCalled();
  });

  it("should not render menu when anchor is null", () => {
    renderSeriesContextMenu({ ...defaultProps, anchor: null });
    expect(screen.queryByText(/Ungroup Series/i)).not.toBeInTheDocument();
  });

  it("should report a deleteSeries failure", async () => {
    vi.mocked(api.deleteSeries).mockRejectedValue(new Error("Delete failed"));

    const { store } = renderSeriesContextMenu();

    await user.click(screen.getByText(/Ungroup Series/i));
    await user.click(screen.getByRole("button", { name: /Ungroup series/i }));

    expect(api.deleteSeries).toHaveBeenCalledWith(mockSeries.id);
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to remove series")),
    );
    expect(store.getState().errorNotification.pending).toEqual([
      { context: "series", code: ErrorCode.other },
    ]);
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
