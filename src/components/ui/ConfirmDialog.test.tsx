import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/utils";
import ConfirmDialog from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  const user = userEvent.setup();

  const defaultProps = {
    open: true,
    title: "Delete this collection?",
    description: "This action cannot be undone.",
    confirmLabel: "Delete",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the title, description, and both buttons", () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText("Delete this collection?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("should call onConfirm when the confirming button is clicked", async () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(defaultProps.onConfirm).toHaveBeenCalledOnce();
    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });

  it("should call onCancel when the cancel button is clicked", async () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(defaultProps.onCancel).toHaveBeenCalledOnce();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it("should focus cancel so an accidental Enter does not confirm", () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("should render nothing when closed", () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("Delete this collection?")).not.toBeInTheDocument();
  });
});
