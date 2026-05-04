import { error as logError } from "@tauri-apps/plugin-log";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../../../bindings/BookCommands";
import * as SeriesCommand from "../../../../bindings/SeriesCommand";
import { renderWithProviders } from "../../../../test/utils";
import type { Series } from "../../../../types/DatabaseModels";
import SetSeriesDialog, { type SetSeriesDialogProps } from "./SetSeriesDialog";

describe("SetSeriesDialog", () => {
  const user = userEvent.setup();

  const mockSeries: Series[] = [
    { id: 1, name: "Series A", created_at: "2026-03-01T15:30:00" },
    { id: 2, name: "Series B", created_at: "2026-03-01T15:30:00" },
  ];

  const defaultProps: SetSeriesDialogProps = {
    openDialog: true,
    bookIds: [101, 102],
    availableSeries: mockSeries,
    onUpdateSeries: vi.fn(),
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
    expect(defaultProps.onUpdateSeries).toHaveBeenCalled();
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

  it("should create a new series", async () => {
    vi.mocked(SeriesCommand.createSeries).mockResolvedValue(3);

    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    await user.click(screen.getByText(/Create new series/i));

    const nameInput = screen.getByPlaceholderText(/Series name/i);
    await user.type(nameInput, "New Series");
    await user.click(screen.getByText(/Create/i));

    expect(SeriesCommand.createSeries).toHaveBeenCalledWith("New Series");
    expect(defaultProps.onUpdateSeries).toHaveBeenCalled();
    // After creation, it should be selected (implicitly checked by handleSave behavior, but let's check state via interaction if possible)
    // Here we just check if it was called.
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

  it("should log error if create fails", async () => {
    vi.mocked(SeriesCommand.createSeries).mockRejectedValue(new Error("Create failed"));

    renderWithProviders(<SetSeriesDialog {...defaultProps} />);

    await user.click(screen.getByText(/Create new series/i));
    await user.type(screen.getByPlaceholderText(/Series name/i), "Fail");
    await user.click(screen.getByText(/Create/i));

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to create series"));
    });
  });
});
