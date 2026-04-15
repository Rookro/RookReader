import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/utils";
import CreateBookTagDialog from "./CreateBookTagDialog";

describe("CreateBookTagDialog", () => {
  const user = userEvent.setup();

  it("should render dialog with title", () => {
    renderWithProviders(
      <CreateBookTagDialog openDialog={true} onCreate={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/Create a Tag/i)).toBeInTheDocument();
  });

  it("should enable create button only when name is entered", async () => {
    renderWithProviders(
      <CreateBookTagDialog openDialog={true} onCreate={vi.fn()} onClose={vi.fn()} />,
    );

    const createButton = screen.getByRole("button", { name: /create/i });
    expect(createButton).toBeDisabled();

    const input = screen.getByLabelText(/Tag name/i);
    await user.type(input, "New Tag");

    expect(createButton).toBeEnabled();
  });

  it("should call onCreate with name and selected color", async () => {
    const onCreate = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <CreateBookTagDialog openDialog={true} onCreate={onCreate} onClose={onClose} />,
    );

    await user.type(screen.getByLabelText(/Tag name/i), "Blue Tag");

    // In MUI Dialog, we have:
    // 1 close icon button
    // 40 color icon buttons
    // 2 action buttons (cancel, create)
    const buttons = screen.getAllByRole("button");
    // The 11th color button (index 1 + 10 = 11) is Blue 500
    await user.click(buttons[11]);

    await user.click(screen.getByRole("button", { name: /create/i }));

    expect(onCreate).toHaveBeenCalledWith("Blue Tag", "#2196F3");
    expect(onClose).toHaveBeenCalled();
  });

  it("should call onClose when cancel is clicked", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <CreateBookTagDialog openDialog={true} onCreate={vi.fn()} onClose={onClose} />,
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
