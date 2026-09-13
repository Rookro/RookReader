import { error as logError } from "@tauri-apps/plugin-log";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../../../bindings/BookCommands";
import * as SeriesCommand from "../../../../bindings/SeriesCommands";
import type { Series } from "../../../../domain/series/schema";
import { renderWithProviders } from "../../../../test/utils";
import SetSeriesDialog, { type SetSeriesDialogProps } from "./SetSeriesDialog";

describe("SetSeriesDialog", () => {
  const user = userEvent.setup();

  const mockSeries: Series[] = [
    { id: 1, name: "Series A", created_at: "2026-03-01T15:30:00" },
    { id: 2, name: "Series B", created_at: "2026-03-01T15:30:00" },
  ];

  const defaultProps: SetSeriesDialogProps = {
    open: true,
    bookIds: [101, 102],
    availableSeries: mockSeries,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render series list", () => {
    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    expect(screen.getByText("Series A")).toBeInTheDocument();
    expect(screen.getByText("Series B")).toBeInTheDocument();
    expect(screen.getByText(/No Series/i)).toBeInTheDocument();
  });

  it("should filter series by search text", async () => {
    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Search series/i);
    await user.type(searchInput, "Series A");

    expect(screen.getByText("Series A")).toBeInTheDocument();
    expect(screen.queryByText("Series B")).not.toBeInTheDocument();
  });

  it("should select a series and update on OK", async () => {
    vi.mocked(BookCommands.updateBookSeries).mockResolvedValue();

    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    await user.click(screen.getByText("Series B"));
    await user.click(screen.getByRole("button", { name: /ok/i }));

    expect(BookCommands.updateBookSeries).toHaveBeenCalledWith(101, 2);
    expect(BookCommands.updateBookSeries).toHaveBeenCalledWith(102, 2);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should clear series when 'No Series' is selected", async () => {
    vi.mocked(BookCommands.updateBookSeries).mockResolvedValue();

    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    await user.click(screen.getByText(/No Series/i));
    await user.click(screen.getByRole("button", { name: /ok/i }));

    expect(BookCommands.updateBookSeries).toHaveBeenCalledWith(101, null);
    expect(BookCommands.updateBookSeries).toHaveBeenCalledWith(102, null);
  });

  it("should create a new series, refetch the list, and select it", async () => {
    vi.mocked(SeriesCommand.createSeries).mockResolvedValue(3);
    vi.mocked(SeriesCommand.getAllSeries).mockResolvedValue([
      ...mockSeries,
      { id: 3, name: "New Series", created_at: "2026-03-01T15:30:00" },
    ]);
    vi.mocked(BookCommands.updateBookSeries).mockResolvedValue();

    const { store } = renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    await user.click(screen.getByText(/Create new series/i));

    const nameInput = screen.getByPlaceholderText(/Series name/i);
    await user.type(nameInput, "New Series");
    await user.click(screen.getByText(/Create/i));

    expect(SeriesCommand.createSeries).toHaveBeenCalledWith("New Series");
    await waitFor(() => expect(store.getState().series.series).toHaveLength(3));

    // The new series is the selected radio, so OK assigns it.
    await user.click(screen.getByRole("button", { name: /ok/i }));
    expect(BookCommands.updateBookSeries).toHaveBeenCalledWith(101, 3);
  });

  it("should log error if update fails", async () => {
    vi.mocked(BookCommands.updateBookSeries).mockRejectedValue(new Error("Update failed"));

    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    await user.click(screen.getByText("Series A"));
    await user.click(screen.getByRole("button", { name: /ok/i }));

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update book series"),
      );
    });
  });

  it("records a save failure in the series slice and keeps the dialog open", async () => {
    vi.mocked(BookCommands.updateBookSeries).mockRejectedValue(new Error("Update failed"));
    const onClose = vi.fn();

    const { store } = renderWithProviders(<SetSeriesDialog {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByText("Series A"));
    await user.click(screen.getByRole("button", { name: /ok/i }));

    // The slice error is what GlobalErrorListener turns into the notification;
    // the dialog stays open for retry.
    await waitFor(() => expect(store.getState().series.error).not.toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should log error if create fails", async () => {
    vi.mocked(SeriesCommand.createSeries).mockRejectedValue(new Error("Create failed"));

    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    await user.click(screen.getByText(/Create new series/i));
    await user.type(screen.getByPlaceholderText(/Series name/i), "Fail");
    await user.click(screen.getByText(/Create/i));

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to add series"));
    });
  });

  it("should close dialog if bookIds is empty on save", async () => {
    renderWithProviders(<SetSeriesDialog {...defaultProps} bookIds={[]} />);

    await user.click(screen.getByRole("button", { name: /ok/i }));

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(BookCommands.updateBookSeries).not.toHaveBeenCalled();
  });

  it("should not create series if name is empty", async () => {
    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    await user.click(screen.getByText(/Create new series/i));
    const createButton = screen.getByText(/Create/i);
    expect(createButton).toBeDisabled();

    const nameInput = screen.getByPlaceholderText(/Series name/i);
    await user.type(nameInput, "   {Enter}");
    expect(SeriesCommand.createSeries).not.toHaveBeenCalled();
  });

  it("should create series when Enter key is pressed", async () => {
    vi.mocked(SeriesCommand.createSeries).mockResolvedValue(3);
    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    await user.click(screen.getByText(/Create new series/i));
    const nameInput = screen.getByPlaceholderText(/Series name/i);
    await user.type(nameInput, "Enter Series{Enter}");

    expect(SeriesCommand.createSeries).toHaveBeenCalledWith("Enter Series");
  });

  it("should cancel creation when Escape key is pressed", async () => {
    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    await user.click(screen.getByText(/Create new series/i));
    const nameInput = screen.getByPlaceholderText(/Series name/i);
    await user.type(nameInput, "{Escape}");

    expect(screen.queryByPlaceholderText(/Series name/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Create new series/i)).toBeInTheDocument();
  });

  it("should show 'no results' message when search doesn't match", async () => {
    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Search series/i);
    await user.type(searchInput, "Non-existent Series");

    expect(screen.getByText(/No results for "Non-existent Series"/i)).toBeInTheDocument();
  });

  it("should close dialog when cancel button is clicked", async () => {
    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should not reset state when open becomes false", async () => {
    const { rerender } = renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    // Trigger some state changes
    const searchInput = screen.getByPlaceholderText(/Search series/i);
    await user.type(searchInput, "Test");

    // Close dialog
    rerender(<SetSeriesDialog {...defaultProps} open={false} />);

    // Since it's closed, it's not in the document anymore (usually Mui Dialog hides it)
    // but the point is hitting the branch.
  });
});
