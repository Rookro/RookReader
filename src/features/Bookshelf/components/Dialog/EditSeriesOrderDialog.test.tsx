import { error as logError } from "@tauri-apps/plugin-log";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../../../bindings/BookCommands";
import i18n from "../../../../i18n/config";
import { createMockBookWithState } from "../../../../test/factories";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import * as seriesSlice from "../../seriesSlice";
import { fetchBooksInSelectedBookshelf } from "../../slice";
import EditSeriesOrderDialog from "./EditSeriesOrderDialog";

// Mock the seriesSlice module to intercept thunk calls
vi.mock("../../seriesSlice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../seriesSlice")>();
  return {
    ...actual,
    updateSeriesOrdersThunk: vi.fn(() => ({ type: "mock/updateSeriesOrdersThunk" })),
  };
});

describe("EditSeriesOrderDialog", () => {
  const user = userEvent.setup();
  const volumes = [1, 2, 3, 4, 5].map((n) =>
    createMockBookWithState({ id: n, display_name: `Book ${n}`, series_id: 9, series_order: n }),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage("en-US");
    vi.mocked(BookCommands.getBooksWithStateBySeriesId).mockResolvedValue(volumes.slice(0, 3));
  });

  it("should render correctly when open including book details", async () => {
    vi.mocked(BookCommands.getBooksWithStateBySeriesId).mockResolvedValue([
      createMockBookWithState({
        id: 1,
        display_name: "Book 1",
        thumbnail_path: "path/to/thumb.jpg",
        series_order: 1,
      }),
      createMockBookWithState({
        id: 2,
        display_name: "Book 2",
        thumbnail_path: null,
        series_order: 2,
      }),
    ]);
    renderWithProviders(<EditSeriesOrderDialog open={true} seriesId={9} onClose={vi.fn()} />);

    expect(screen.getByText("Edit Series Order")).toBeInTheDocument();
    expect(await screen.findByText("Book 1")).toBeInTheDocument();
    expect(screen.getByText("# 1")).toBeInTheDocument();
    expect(screen.getByText("Book 2")).toBeInTheDocument();
    expect(screen.getByText("# 2")).toBeInTheDocument();

    const images = screen.getAllByRole("img");
    const thumb1 = images.find((img) => img.getAttribute("src") === "asset://path/to/thumb.jpg");
    expect(thumb1).toBeDefined();
  });

  it("should not render when closed", () => {
    renderWithProviders(<EditSeriesOrderDialog open={false} seriesId={9} onClose={vi.fn()} />);
    expect(screen.queryByText("Edit Series Order")).not.toBeInTheDocument();
  });

  it("should call onClose when cancel button is clicked", async () => {
    const handleClose = vi.fn();
    renderWithProviders(<EditSeriesOrderDialog open={true} seriesId={9} onClose={handleClose} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(handleClose).toHaveBeenCalled();
  });

  // Inside a collection only some volumes are on screen; renumbering those would collide
  it("lists the whole series, not only the volumes in the open collection", async () => {
    vi.mocked(BookCommands.getBooksWithStateBySeriesId).mockResolvedValue(volumes);
    const preloadedState = createBasePreloadedState();
    preloadedState.bookCollection.books = volumes.slice(3);

    renderWithProviders(<EditSeriesOrderDialog open={true} seriesId={9} onClose={vi.fn()} />, {
      preloadedState,
    });

    expect(await screen.findByText("Book 1")).toBeInTheDocument();
    expect(screen.getAllByText(/^# \d$/)).toHaveLength(5);
    expect(BookCommands.getBooksWithStateBySeriesId).toHaveBeenCalledWith(9);
  });

  it("should dispatch updateSeriesOrdersThunk with every volume when save is clicked", async () => {
    vi.mocked(BookCommands.getBooksWithStateBySeriesId).mockResolvedValue(volumes);
    const handleClose = vi.fn();
    renderWithProviders(<EditSeriesOrderDialog open={true} seriesId={9} onClose={handleClose} />);

    await screen.findByText("Book 5");
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(seriesSlice.updateSeriesOrdersThunk).toHaveBeenCalledWith([1, 2, 3, 4, 5]);
    expect(handleClose).toHaveBeenCalled();
  });

  // A bookshelf refresh while the dialog is open must not throw away a drag in progress
  it("loads the series once per opening", async () => {
    const { store } = renderWithProviders(
      <EditSeriesOrderDialog open={true} seriesId={9} onClose={vi.fn()} />,
    );
    await screen.findByText("Book 1");

    vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue([volumes[0]]);
    await act(async () => {
      await store.dispatch(fetchBooksInSelectedBookshelf(null));
    });

    await waitFor(() => expect(screen.getByText("Book 3")).toBeInTheDocument());
    expect(BookCommands.getBooksWithStateBySeriesId).toHaveBeenCalledTimes(1);
  });

  // Saving after a failed read would renumber a series the dialog never saw
  it("disables OK when the series could not be loaded", async () => {
    vi.mocked(BookCommands.getBooksWithStateBySeriesId).mockRejectedValue(new Error("boom"));
    renderWithProviders(<EditSeriesOrderDialog open={true} seriesId={9} onClose={vi.fn()} />);

    // Disabled while loading too, so check it once the failure has been handled.
    await waitFor(() =>
      expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch the books")),
    );
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
  });
});
