import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateBookshelfDialog } from "./CreateBookshelfDialog";
import { renderWithProviders } from "../../../../test/utils";
import i18n from "../../../../i18n/config";

describe("CreateBookshelfDialog", () => {
  const user = userEvent.setup();

  const defaultProps = {
    openDialog: true,
    onCreate: vi.fn(),
    onClose: vi.fn(),
  };

  // Verify that title and name input field are displayed correctly when the dialog is open
  it("should render correctly when open", () => {
    renderWithProviders(<CreateBookshelfDialog {...defaultProps} />);

    expect(screen.getByText(i18n.t("bookshelf.collection.creation.title"))).toBeInTheDocument();
    expect(
      screen.getByLabelText(i18n.t("bookshelf.collection.creation.name-placeholder")),
    ).toBeInTheDocument();
  });

  // Verify that the create button is enabled only when a name is entered
  it("should enable create button only when name is entered", async () => {
    renderWithProviders(<CreateBookshelfDialog {...defaultProps} />);

    const createButton = screen.getByText(i18n.t("bookshelf.collection.creation.creation-button"));
    expect(createButton).toBeDisabled();

    const nameInput = screen.getByLabelText(
      i18n.t("bookshelf.collection.creation.name-placeholder"),
    );
    await user.type(nameInput, "My Bookshelf");

    expect(createButton).not.toBeDisabled();
  });

  // Verify that onCreate is called with the entered name and icon info when the create button is clicked
  it("should call onCreate with name and icon when create button is clicked", async () => {
    const onCreate = vi.fn();
    renderWithProviders(<CreateBookshelfDialog {...defaultProps} onCreate={onCreate} />);

    const nameInput = screen.getByLabelText(
      i18n.t("bookshelf.collection.creation.name-placeholder"),
    );
    await user.type(nameInput, "My Bookshelf");

    const createButton = screen.getByText(i18n.t("bookshelf.collection.creation.creation-button"));
    await user.click(createButton);

    expect(onCreate).toHaveBeenCalledWith("My Bookshelf", expect.any(String));
  });

  // Verify that onClose is called when the cancel button is clicked
  it("should call onClose when cancel button is clicked", async () => {
    const onClose = vi.fn();
    renderWithProviders(<CreateBookshelfDialog {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByText(i18n.t("bookshelf.collection.creation.cancel-button"));
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });
});
