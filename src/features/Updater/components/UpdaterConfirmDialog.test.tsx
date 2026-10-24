import { error } from "@tauri-apps/plugin-log";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Update } from "@tauri-apps/plugin-updater";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import UpdaterConfirmDialog from "./UpdaterConfirmDialog";

describe("UpdaterConfirmDialog", () => {
  const mockUpdate = {
    version: "2.0.0",
    currentVersion: "1.0.0",
    date: "2023-10-01",
    body: "This is a release note.\n- Feature A\n- Fix B",
    downloadAndInstall: vi.fn(),
  } as unknown as Update;

  const renderDialog = ({ body }: { body: string }) =>
    renderWithProviders(
      <UpdaterConfirmDialog
        open
        update={{ ...mockUpdate, body } as Update}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

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

  it("opens release-note links in the browser", async () => {
    const user = userEvent.setup();
    renderDialog({ body: "See [the release](https://github.com/Rookro/RookReader/releases)." });
    await user.click(screen.getByRole("link", { name: "the release" }));
    expect(openUrl).toHaveBeenCalledWith("https://github.com/Rookro/RookReader/releases");
  });

  it("opens mailto links in the mail app", async () => {
    const user = userEvent.setup();
    renderDialog({ body: "[mail](mailto:a@example.com)" });
    await user.click(screen.getByRole("link", { name: "mail" }));
    expect(openUrl).toHaveBeenCalledWith("mailto:a@example.com");
  });

  it("does not turn a relative link into a link", () => {
    renderDialog({ body: "[local](../CHANGELOG.md)" });
    expect(screen.queryByRole("link", { name: "local" })).toBeNull();
    expect(screen.getByText("local")).toBeInTheDocument();
  });

  it("logs a failure to open a link and keeps the window where it is", async () => {
    vi.mocked(openUrl).mockRejectedValueOnce(new Error("denied"));
    renderDialog({ body: "[x](https://example.com)" });
    // `fireEvent` returns false when the handler prevented the default navigation.
    expect(fireEvent.click(screen.getByRole("link", { name: "x" }))).toBe(false);
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining("denied")));
  });
});
