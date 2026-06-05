import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../../i18n/config";
import { createMockBookWithState } from "../../../../test/factories";
import { renderWithProviders } from "../../../../test/utils";
import * as seriesSlice from "../../seriesSlice";
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
  const mockBooks = [
    createMockBookWithState({ id: 1, display_name: "Book 1" }),
    createMockBookWithState({ id: 2, display_name: "Book 2" }),
    createMockBookWithState({ id: 3, display_name: "Book 3" }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage("en-US");
  });

  it("should render correctly when open including book details", () => {
    const booksWithDetails = [
      createMockBookWithState({
        id: 1,
        display_name: "Book 1",
        thumbnail_path: "path/to/thumb.jpg",
      }),
      createMockBookWithState({ id: 2, display_name: "Book 2", thumbnail_path: null }),
    ];
    renderWithProviders(
      <EditSeriesOrderDialog openDialog={true} books={booksWithDetails} onClose={vi.fn()} />,
    );

    expect(screen.getByText("Edit Series Order")).toBeInTheDocument();

    // Check Book 1
    expect(screen.getByText("Book 1")).toBeInTheDocument();
    expect(screen.getByText("# 1")).toBeInTheDocument();

    // Check Book 2
    expect(screen.getByText("Book 2")).toBeInTheDocument();
    expect(screen.getByText("# 2")).toBeInTheDocument();

    // Check thumbnails
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(2);

    // Verify specific thumbnail for Book 1
    const thumb1 = images.find((img) => img.getAttribute("src") === "asset://path/to/thumb.jpg");
    expect(thumb1).toBeDefined();
  });

  it("should not render when closed", () => {
    renderWithProviders(
      <EditSeriesOrderDialog openDialog={false} books={mockBooks} onClose={vi.fn()} />,
    );
    expect(screen.queryByText("Edit Series Order")).not.toBeInTheDocument();
  });

  it("should call onClose when cancel button is clicked", async () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <EditSeriesOrderDialog openDialog={true} books={mockBooks} onClose={handleClose} />,
    );

    const cancelButton = screen.getByRole("button", { name: "cancel" });
    await user.click(cancelButton);
    expect(handleClose).toHaveBeenCalled();
  });

  it("should dispatch updateSeriesOrdersThunk with correct IDs when save is clicked", async () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <EditSeriesOrderDialog openDialog={true} books={mockBooks} onClose={handleClose} />,
    );

    const okButton = screen.getByRole("button", { name: "ok" });
    await user.click(okButton);

    // Verify the thunk itself was called with the expected IDs
    expect(seriesSlice.updateSeriesOrdersThunk).toHaveBeenCalledWith([1, 2, 3]);
    expect(handleClose).toHaveBeenCalled();
  });
});
