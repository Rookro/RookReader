import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import FloatingActionBar from "./FloatingActionBar";

describe("FloatingActionBar", () => {
  const user = userEvent.setup();
  const defaultProps = {
    selectionCount: 2,
    onClear: vi.fn(),
    onAddToBookshelf: vi.fn(),
    onSetTags: vi.fn(),
    onDelete: vi.fn(),
  };

  it("should render selection count and buttons", () => {
    renderWithProviders(<FloatingActionBar {...defaultProps} />);

    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add to Collection/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Set tags/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove book/i })).toBeInTheDocument();
  });

  it("should call callbacks when buttons are clicked", async () => {
    renderWithProviders(<FloatingActionBar {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /Add to Collection/i }));
    expect(defaultProps.onAddToBookshelf).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Set tags/i }));
    expect(defaultProps.onSetTags).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Remove book/i }));
    expect(defaultProps.onDelete).toHaveBeenCalled();

    await user.click(screen.getByTitle(/Clear selection/i));
    expect(defaultProps.onClear).toHaveBeenCalled();
  });

  it("should return null if count is 0", () => {
    const { container } = renderWithProviders(
      <FloatingActionBar {...defaultProps} selectionCount={0} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
