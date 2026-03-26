import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpdaterConfirmDialog from "./UpdaterConfirmDialog";
import { renderWithProviders } from "../../test/utils";
import { Update } from "@tauri-apps/plugin-updater";

describe("UpdaterConfirmDialog", () => {
  const mockUpdate = {
    version: "2.0.0",
    currentVersion: "1.0.0",
    date: "2023-10-01",
    body: "This is a release note.\n- Feature A\n- Fix B",
    downloadAndInstall: vi.fn(),
  } as unknown as Update;

  it("should not render when open is false", () => {
    renderWithProviders(
      <UpdaterConfirmDialog
        open={false}
        update={mockUpdate}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should not render when update is null", () => {
    renderWithProviders(
      <UpdaterConfirmDialog open={true} update={null} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should render dialog content correctly", () => {
    renderWithProviders(
      <UpdaterConfirmDialog
        open={true}
        update={mockUpdate}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/2\.0\.0/)).toBeInTheDocument();
    expect(screen.getByText(/This is a release note/)).toBeInTheDocument();
  });

  it("should call onConfirm when 'Yes' is clicked", async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn();

    renderWithProviders(
      <UpdaterConfirmDialog
        open={true}
        update={mockUpdate}
        onConfirm={handleConfirm}
        onCancel={vi.fn()}
      />,
    );

    const yesButtons = screen.getAllByRole("button");
    // Usually, "Yes" is the last button since "No" comes first in the DOM structure
    await user.click(yesButtons[yesButtons.length - 1]);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("should call onCancel when 'No' is clicked", async () => {
    const user = userEvent.setup();
    const handleCancel = vi.fn();

    renderWithProviders(
      <UpdaterConfirmDialog
        open={true}
        update={mockUpdate}
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />,
    );

    const noButtons = screen.getAllByRole("button");
    // "No" is the first button in the actions list
    await user.click(noButtons[0]);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});
