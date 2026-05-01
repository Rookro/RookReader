import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState } from "../../../test/factories";
import { renderWithProviders } from "../../../test/utils";
import BookContextMenu from "./BookContextMenu";

describe("BookContextMenu", () => {
  const user = userEvent.setup();
  const mockBook = createMockBookWithState({ id: 1, display_name: "Test Book" });
  const defaultProps = {
    anchor: { mouseX: 100, mouseY: 100, book: mockBook },
    onClose: vi.fn(),
    onAddToBookshelf: vi.fn(),
    onSetTags: vi.fn(),
    onDelete: vi.fn(),
  };

  it("should render menu items when anchor is provided", () => {
    renderWithProviders(<BookContextMenu {...defaultProps} />);

    expect(screen.getByText(/Add to Collection/i)).toBeInTheDocument();
    expect(screen.getByText(/Set tags/i)).toBeInTheDocument();
    expect(screen.getByText(/Remove book/i)).toBeInTheDocument();
  });

  it("should call callbacks and onClose when items are clicked", async () => {
    renderWithProviders(<BookContextMenu {...defaultProps} />);

    await user.click(screen.getByText(/Add to Collection/i));
    expect(defaultProps.onAddToBookshelf).toHaveBeenCalledWith(mockBook);
    expect(defaultProps.onClose).toHaveBeenCalled();

    await user.click(screen.getByText(/Set tags/i));
    expect(defaultProps.onSetTags).toHaveBeenCalledWith(mockBook);

    await user.click(screen.getByText(/Remove book/i));
    expect(defaultProps.onDelete).toHaveBeenCalledWith(mockBook);
  });

  it("should not render menu when anchor is null", () => {
    renderWithProviders(<BookContextMenu {...defaultProps} anchor={null} />);
    expect(screen.queryByText(/Add to Collection/i)).not.toBeInTheDocument();
  });
});
