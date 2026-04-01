import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpdaterMessageDialog from "./UpdaterMessageDialog";
import { renderWithProviders } from "../../../test/utils";

describe("UpdaterMessageDialog", () => {
  it("should not render when open is false", () => {
    renderWithProviders(
      <UpdaterMessageDialog
        open={false}
        title="Test Title"
        message="Test Message"
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should render dialog content correctly", () => {
    renderWithProviders(
      <UpdaterMessageDialog
        open={true}
        title="Test Title"
        message="Test Message"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Message")).toBeInTheDocument();
  });

  it("should call onClose when OK button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(
      <UpdaterMessageDialog
        open={true}
        title="Test Title"
        message="Test Message"
        onClose={handleClose}
      />,
    );

    const okButton = screen.getByRole("button");
    await user.click(okButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
